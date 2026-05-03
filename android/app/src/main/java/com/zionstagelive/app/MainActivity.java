package com.zionstagelive.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registration MUST happen before or during initialization
        registerPlugin(MultitrackPlugin.class);
        registerPlugin(NextGenMixerPlugin.class);
        registerPlugin(BandSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
