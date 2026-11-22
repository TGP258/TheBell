package pascal.thebell;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 分段倒计时的系统级实时通知。
 *
 * 设计要点：
 *  - 计时状态由 JS 层保存为绝对结束时间戳，通知用 Chronometer 由 SystemUI 自行刷新，
 *    因此应用切后台、被冻结或被杀死时状态栏倒计时仍然准确，无需常驻前台服务。
 *  - 结束提醒由 AlarmManager 在 endsAt 触发，不依赖 WebView 是否存活。
 *  - Android 16 QPR1+ 的 Live Updates / One UI 8+ 的 Now Bar 通过
 *    POST_PROMOTED_NOTIFICATIONS + android.requestPromotedOngoing 请求提升；
 *    该请求以 extras 字符串写入，避免把 compileSdk 抬到 36.1。
 */
@CapacitorPlugin(
        name = "SegmentLive",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class SegmentLivePlugin extends Plugin {

    public static final String PREFS = "thebell_live";
    public static final String KEY_PENDING = "pending_actions";
    public static final String KEY_LIVE_INFO = "live_info";

    public static final String CHANNEL_LIVE = "thebell_live";
    public static final String CHANNEL_END = "thebell_end";
    public static final int LIVE_ID = 4201;
    public static final int END_ID = 4202;
    public static final int ALARM_REQUEST = 4203;

    public static final String ACTION_ALARM_END = "pascal.thebell.LIVE_ALARM_END";
    public static final String ACTION_PAUSE = "pascal.thebell.LIVE_PAUSE";
    public static final String ACTION_RESUME = "pascal.thebell.LIVE_RESUME";
    public static final String ACTION_NEXT = "pascal.thebell.LIVE_NEXT";
    public static final String EXTRA_ACTION = "live_action";
    public static final String EXTRA_DAY_IDX = "day_idx";
    public static final String EXTRA_ROUTINE_ID = "routine_id";

    private static final int BRAND = Color.parseColor("#2563EB");
    private static volatile SegmentLivePlugin active;

    @Override
    public void load() {
        active = this;
        ensureChannels(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (active == this) active = null;
        super.handleOnDestroy();
    }

    // ------------------------------------------------------------------ 权限

    @PluginMethod
    public void checkPermission(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !runtimeGranted()) {
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        call.resolve(permissionState());
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = null;
        // Android 16：直达「实时动态」开关页
        if (Build.VERSION.SDK_INT >= 36) {
            Intent promoted = new Intent("android.settings.APP_NOTIFICATION_PROMOTION_SETTINGS");
            promoted.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            if (promoted.resolveActivity(ctx.getPackageManager()) != null) intent = promoted;
        }
        if (intent == null) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开通知设置", e);
        }
    }

    private boolean runtimeGranted() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject permissionState() {
        boolean enabled = notificationsEnabled(getContext());
        boolean exact = canScheduleExact(getContext());
        JSObject result = new JSObject();
        result.put("granted", enabled && runtimeGranted());
        result.put("enabled", enabled);
        result.put("canScheduleExact", exact);
        return result;
    }

    static boolean notificationsEnabled(Context ctx) {
        NotificationManager manager =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= 24) return manager.areNotificationsEnabled();
        return true;
    }

    // ------------------------------------------------------- 实时通知的发布

    @PluginMethod
    public void publish(PluginCall call) {
        Context ctx = getContext();
        ensureChannels(ctx);
        if (!notificationsEnabled(ctx) || !runtimeGranted()) {
            call.resolve();
            return;
        }

        String title = nonEmpty(call.getString("title"), "专注中");
        String subtitle = nonEmpty(call.getString("subtitle"), "TheBell · 分段倒计时");
        String shortText = nonEmpty(call.getString("shortText"), "00:00");
        String state = nonEmpty(call.getString("state"), "running");
        String nextTitle = call.getString("nextTitle");
        int totalSec = Math.max(1, call.getInt("totalSec", 3000));
        int remainingSec = Math.max(0, call.getInt("remainingSec", 0));
        int dayIdx = call.getInt("dayIdx", 1);
        int routineId = call.getInt("routineId", 0);
        long endsAt = longValue(call.getData().opt("endsAt"));
        boolean running = "running".equals(state) && endsAt > System.currentTimeMillis();

        saveLiveInfo(ctx, title, subtitle, dayIdx, routineId, nextTitle);

        Notification.Builder builder = new Notification.Builder(ctx, CHANNEL_LIVE)
                .setSmallIcon(R.drawable.ic_stat_live)
                .setContentTitle(title)
                .setContentText(subtitle)
                .setSubText("TheBell · " + (running ? "进行中" : "已暂停"))
                .setColor(BRAND)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setProgress(totalSec, Math.max(0, Math.min(totalSec, totalSec - remainingSec)), false)
                .setContentIntent(openIntent(ctx, false))
                .setDeleteIntent(actionIntent(ctx, ACTION_PAUSE, dayIdx, routineId, 26));

        if (running) {
            long remainingMs = endsAt - System.currentTimeMillis();
            // setUsesChronometer 把 when 当作 elapsedRealtime 基准的墙钟时间；
            // 传入「当前时刻 + 剩余毫秒」即得到倒数显示的基准。
            builder.setWhen(System.currentTimeMillis() + remainingMs)
                    .setUsesChronometer(true);
            if (Build.VERSION.SDK_INT >= 24) builder.setChronometerCountDown(true);
        } else {
            builder.setWhen(System.currentTimeMillis());
            builder.setContentText(subtitle + " · 剩余 " + shortText);
        }

        applyPromotionExtras(builder, shortText, title);
        applyProgressStyle(builder, totalSec, remainingSec, subtitle);

        if (running) {
            builder.addAction(pauseAction(ctx, dayIdx, routineId));
        } else {
            builder.addAction(resumeAction(ctx, dayIdx, routineId));
        }
        if (nextTitle != null && !nextTitle.isEmpty()) {
            builder.addAction(new Notification.Action.Builder(
                    R.drawable.ic_stat_live,
                    "下一段",
                    actionIntent(ctx, ACTION_NEXT, dayIdx, routineId, 23)
            ).build());
        }

        try {
            notificationManager(ctx).notify(LIVE_ID, builder.build());
        } catch (Exception e) {
            call.reject("发布实时通知失败", e);
            return;
        }

        if (running) scheduleEndAlarm(ctx, endsAt);
        else cancelEndAlarm(ctx);

        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        cancelEndAlarm(ctx);
        notificationManager(ctx).cancel(LIVE_ID);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(KEY_LIVE_INFO).apply();
        call.resolve();
    }

    @PluginMethod
    public void notifyEnd(PluginCall call) {
        Context ctx = getContext();
        String title = nonEmpty(call.getString("title"), "本段倒计时");
        String nextTitle = call.getString("nextTitle");
        JSONObject info = readLiveInfo(ctx);
        int dayIdx = info != null ? info.optInt("dayIdx", 1) : 1;
        int routineId = info != null ? info.optInt("routineId", 0) : 0;
        String subtitle = info != null ? info.optString("subtitle", "") : "";
        postEndNotification(ctx, title, subtitle, nextTitle, dayIdx, routineId);
        call.resolve();
    }

    @PluginMethod
    public void drainPending(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PENDING, "[]");
        prefs.edit().remove(KEY_PENDING).apply();
        JSArray actions = new JSArray();
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i += 1) {
                actions.put(JSObject.fromJSONObject(array.getJSONObject(i)));
            }
        } catch (JSONException ignored) {
            // 损坏的队列直接丢弃
        }
        JSObject result = new JSObject();
        result.put("actions", actions);
        call.resolve(result);
    }

    static void emitAction(Context ctx, JSObject event) {
        appendPending(ctx, event);
        SegmentLivePlugin plugin = active;
        if (plugin != null) plugin.notifyListeners("action", event);
    }

    // --------------------------------------------------------------- 工具方法

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = notificationManager(ctx);
        if (manager.getNotificationChannel(CHANNEL_LIVE) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_LIVE, "进行中的专注", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("分段倒计时的实时进度，显示在状态栏与锁屏");
            channel.setSound(null, null);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
        }
        if (manager.getNotificationChannel(CHANNEL_END) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_END, "时段结束提醒", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("一段倒计时结束时提醒你继续下一段");
            channel.enableVibration(true);
            manager.createNotificationChannel(channel);
        }
    }

    static NotificationManager notificationManager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    static PendingIntent openIntent(Context ctx, boolean fromEnd) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("fromLive", true);
        intent.putExtra("segmentEnd", fromEnd);
        return PendingIntent.getActivity(ctx, fromEnd ? 21 : 20, intent, pendingFlags());
    }

    static PendingIntent actionIntent(Context ctx, String action, int dayIdx, int routineId, int request) {
        Intent intent = new Intent(ctx, SegmentLiveReceiver.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_DAY_IDX, dayIdx);
        intent.putExtra(EXTRA_ROUTINE_ID, routineId);
        return PendingIntent.getBroadcast(ctx, request, intent, pendingFlags());
    }

    private static int pendingFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static Notification.Action pauseAction(Context ctx, int dayIdx, int routineId) {
        return new Notification.Action.Builder(
                R.drawable.ic_stat_live,
                "暂停",
                actionIntent(ctx, ACTION_PAUSE, dayIdx, routineId, 22)
        ).build();
    }

    private static Notification.Action resumeAction(Context ctx, int dayIdx, int routineId) {
        return new Notification.Action.Builder(
                R.drawable.ic_stat_live,
                "继续",
                actionIntent(ctx, ACTION_RESUME, dayIdx, routineId, 24)
        ).build();
    }

    /** Android 16 QPR1+ 的 Live Updates 提升请求（以字符串常量兼容 compileSdk 35）。 */
    private static void applyPromotionExtras(Notification.Builder builder, String shortText, String title) {
        Bundle extras = builder.getExtras();
        extras.putBoolean("android.requestPromotedOngoing", true);
        // 部分国产 ROM（含 HyperOS 焦点通知）会读取这些扩展字段；
        // 是否以胶囊形态展示由系统白名单与用户设置决定，应用侧只能提供标准元数据。
        extras.putString("miui.focus.notification.title", title);
        extras.putString("miui.focus.notification.ticker", shortText);
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Notification.Builder.class
                        .getMethod("setShortCriticalText", CharSequence.class)
                        .invoke(builder, shortText);
            } catch (Throwable ignored) {
                // 旧版 Android 16 没有该方法，退回普通状态栏文本
            }
        }
    }

    /** 优先使用 Android 16 ProgressStyle，失败则退回同样合规的 BigTextStyle。 */
    private static void applyProgressStyle(Notification.Builder builder, int totalSec,
                                           int remainingSec, String subtitle) {
        boolean applied = false;
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Class<?> styleClass = Class.forName("android.app.Notification$ProgressStyle");
                Class<?> segmentClass = Class.forName("android.app.Notification$ProgressStyle$Segment");
                Object style = styleClass.getConstructor().newInstance();
                Object segment = segmentClass.getConstructor(int.class).newInstance(totalSec);
                styleClass.getMethod("addProgressSegment", segmentClass).invoke(style, segment);
                styleClass.getMethod("setProgress", int.class)
                        .invoke(style, Math.min(totalSec, Math.max(0, totalSec - remainingSec)));
                Notification.Builder.class
                        .getMethod("setStyle", Notification.Style.class)
                        .invoke(builder, style);
                applied = true;
            } catch (Throwable ignored) {
                applied = false;
            }
        }
        if (!applied) {
            builder.setStyle(new Notification.BigTextStyle().bigText(subtitle));
        }
    }

    static boolean canScheduleExact(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager manager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return manager == null || manager.canScheduleExactAlarms();
    }

    static void scheduleEndAlarm(Context ctx, long endsAt) {
        AlarmManager manager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = PendingIntent.getBroadcast(
                ctx,
                ALARM_REQUEST,
                new Intent(ctx, SegmentLiveReceiver.class).setAction(ACTION_ALARM_END),
                pendingFlags()
        );
        manager.cancel(pending);
        try {
            if (canScheduleExact(ctx)) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
            } else {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
            }
        } catch (SecurityException e) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
        }
    }

    static void cancelEndAlarm(Context ctx) {
        AlarmManager manager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = PendingIntent.getBroadcast(
                ctx,
                ALARM_REQUEST,
                new Intent(ctx, SegmentLiveReceiver.class).setAction(ACTION_ALARM_END),
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pending != null) manager.cancel(pending);
    }

    static void postEndNotification(Context ctx, String title, String subtitle,
                                    String nextTitle, int dayIdx, int routineId) {
        ensureChannels(ctx);
        NotificationManager manager = notificationManager(ctx);
        manager.cancel(LIVE_ID);
        cancelEndAlarm(ctx);

        String text = subtitle.isEmpty() ? title : title + " · " + subtitle;
        if (nextTitle != null && !nextTitle.isEmpty()) text += "\n下一段：" + nextTitle;

        Notification.Builder builder = new Notification.Builder(ctx, CHANNEL_END)
                .setSmallIcon(R.drawable.ic_stat_live)
                .setContentTitle("本段结束")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setColor(BRAND)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openIntent(ctx, true))
                .setFullScreenIntent(openIntent(ctx, true), true)
                .addAction(new Notification.Action.Builder(
                        R.drawable.ic_stat_live,
                        "打开 TheBell",
                        openIntent(ctx, true)
                ).build());

        if (nextTitle != null && !nextTitle.isEmpty()) {
            builder.addAction(new Notification.Action.Builder(
                    R.drawable.ic_stat_live,
                    "开始下一段",
                    actionIntent(ctx, ACTION_NEXT, dayIdx, routineId, 25)
            ).build());
        }

        try {
            manager.notify(END_ID, builder.build());
        } catch (Exception ignored) {
            // 通知权限被撤销时静默失败，应用内的全屏提示仍然可用
        }
    }

    static void saveLiveInfo(Context ctx, String title, String subtitle,
                             int dayIdx, int routineId, String nextTitle) {
        try {
            JSONObject info = new JSONObject();
            info.put("title", title);
            info.put("subtitle", subtitle);
            info.put("dayIdx", dayIdx);
            info.put("routineId", routineId);
            info.put("nextTitle", nextTitle == null ? "" : nextTitle);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putString(KEY_LIVE_INFO, info.toString()).apply();
        } catch (JSONException ignored) {
            // 不会发生
        }
    }

    static JSONObject readLiveInfo(Context ctx) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_LIVE_INFO, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    static void appendPending(Context ctx, JSObject event) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray array = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
            if (array.length() > 40) array = new JSONArray();
            array.put(new JSONObject(event.toString()));
            prefs.edit().putString(KEY_PENDING, array.toString()).apply();
        } catch (JSONException ignored) {
            prefs.edit().remove(KEY_PENDING).apply();
        }
    }

    private static long longValue(Object value) {
        if (value instanceof Number) return ((Number) value).longValue();
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException ignored) {
                return 0L;
            }
        }
        return 0L;
    }

    private static String nonEmpty(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }
}
