package com.jerefrer.TibetanTranslator

import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Don't use edge-to-edge - it causes issues with safe areas in WebView
    super.onCreate(savedInstanceState)
  }
}
