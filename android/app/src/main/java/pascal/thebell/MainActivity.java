package pascal.thebell;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PascalDbPlugin.class);
        registerPlugin(DeviceInfoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
