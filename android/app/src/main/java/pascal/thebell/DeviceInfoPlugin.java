package pascal.thebell;

import android.app.Activity;
import android.content.res.Configuration;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Method;

/**
 * 只读设备信息：系统版本、厂商型号、平板形态与厂商 UI 版本。
 * 不申请任何权限；厂商 UI 版本通过系统属性读取（小米 HyperOS / MIUI），
 * 其他厂商没有对应属性时返回空串，由前端自行降级。
 */
@CapacitorPlugin(name = "DeviceInfo")
public class DeviceInfoPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject result = new JSObject();
        result.put("osVersion", Build.VERSION.RELEASE);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("isTablet", isTablet());
        result.put(
            "uiVersion",
            systemProperty(
                "ro.mi.os.version.name",
                systemProperty("ro.miui.ui.version.name", "")
            )
        );
        call.resolve(result);
    }

    private boolean isTablet() {
        Activity activity = bridge.getActivity();
        if (activity == null) return false;
        Configuration conf = activity.getResources().getConfiguration();
        return (conf.screenLayout & Configuration.SCREENLAYOUT_SIZE_MASK)
            >= Configuration.SCREENLAYOUT_SIZE_LARGE;
    }

    private static String systemProperty(String key, String fallback) {
        try {
            Class<?> props = Class.forName("android.os.SystemProperties");
            Method get = props.getMethod("get", String.class);
            String value = (String) get.invoke(null, key);
            return value == null || value.isEmpty() ? fallback : value;
        } catch (Throwable error) {
            return fallback;
        }
    }
}
