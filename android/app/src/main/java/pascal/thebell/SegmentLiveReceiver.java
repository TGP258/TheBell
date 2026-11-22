package pascal.thebell;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;

import org.json.JSONObject;

/** 处理实时通知上的操作按钮，以及倒计时结束时由 AlarmManager 唤醒的提醒。 */
public class SegmentLiveReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        if (SegmentLivePlugin.ACTION_ALARM_END.equals(action)) {
            handleEnd(context);
            return;
        }

        String event;
        switch (action) {
            case SegmentLivePlugin.ACTION_PAUSE:
                event = "pause";
                break;
            case SegmentLivePlugin.ACTION_RESUME:
                event = "resume";
                break;
            case SegmentLivePlugin.ACTION_NEXT:
                event = "next";
                break;
            default:
                return;
        }

        JSObject payload = new JSObject();
        payload.put("action", event);
        payload.put("dayIdx", intent.getIntExtra(SegmentLivePlugin.EXTRA_DAY_IDX, 1));
        payload.put("routineId", intent.getIntExtra(SegmentLivePlugin.EXTRA_ROUTINE_ID, 0));
        SegmentLivePlugin.emitAction(context, payload);
    }

    private void handleEnd(Context context) {
        JSONObject info = SegmentLivePlugin.readLiveInfo(context);
        String title = info != null ? info.optString("title", "本段倒计时") : "本段倒计时";
        String subtitle = info != null ? info.optString("subtitle", "") : "";
        String nextTitle = info != null ? info.optString("nextTitle", "") : "";
        int dayIdx = info != null ? info.optInt("dayIdx", 1) : 1;
        int routineId = info != null ? info.optInt("routineId", 0) : 0;

        SegmentLivePlugin.postEndNotification(
                context,
                title,
                subtitle,
                nextTitle.isEmpty() ? null : nextTitle,
                dayIdx,
                routineId
        );
        context.getSharedPreferences(SegmentLivePlugin.PREFS, Context.MODE_PRIVATE)
                .edit().remove(SegmentLivePlugin.KEY_LIVE_INFO).apply();
    }
}
