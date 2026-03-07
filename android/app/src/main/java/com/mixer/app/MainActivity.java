package com.mixer.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registration MUST happen before or during initialization
        registerPlugin(MultitrackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
