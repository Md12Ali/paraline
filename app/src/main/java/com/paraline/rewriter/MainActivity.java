package com.paraline.rewriter;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/** A thin shell: the whole app is the offline page in assets/, shown in a WebView. */
public class MainActivity extends Activity {

    private static final String HOME = "file:///android_asset/index.html";
    private static final String ASSETS = "file:///android_asset/";
    /** The only host the page is allowed to call (AI mode, with the user's own key). */
    private static final String API_PREFIX = "https://generativelanguage.googleapis.com/";

    private WebView web;
    private volatile String incoming = "";
    private Object backCallback; // an OnBackInvokedCallback; that class only exists on Android 13+

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15+ draws apps edge to edge: keep the page clear of the status bar,
        // the navigation bar, display cut-outs and the keyboard.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets b = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.setBackgroundColor(0x00000000);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = String.valueOf(request.getUrl());
                if (url.startsWith(ASSETS)) return false;
                openExternally(url);
                return true; // the WebView itself never leaves the bundled page
            }
        });

        readIntent(getIntent());
        web.loadUrl(HOME);

        if (Build.VERSION.SDK_INT >= 33) {
            OnBackInvokedCallback callback = this::handleBack;
            backCallback = callback;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        String text = incoming;
        if (!text.isEmpty()) {
            incoming = "";
            web.evaluateJavascript("window.__incoming&&window.__incoming(" + JSONObject.quote(text) + ")", null);
        }
    }

    /** Text shared from another app, or selected text sent through the "ParaLine" menu item. */
    private void readIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        CharSequence text = null;
        try {
            if (Intent.ACTION_SEND.equals(intent.getAction())) {
                text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            } else if (Intent.ACTION_PROCESS_TEXT.equals(intent.getAction())) {
                text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
            }
        } catch (RuntimeException ignored) {
            // malformed extras from another app: ignore them
        }
        if (text != null && text.length() > 0) incoming = text.toString();
    }

    private void handleBack() {
        web.evaluateJavascript("(window.__back&&window.__back())===true", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack(); // Android 12 and older
    }

    private void openExternally(String url) {
        if (!url.startsWith("https://")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (RuntimeException ignored) {
            // no browser installed
        }
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) backCallback);
        }
        ViewGroup parent = (ViewGroup) web.getParent();
        if (parent != null) parent.removeView(web);
        web.destroy();
        super.onDestroy();
    }

    /** Functions the page can call. Every method runs on a background thread. */
    private final class Bridge {

        @JavascriptInterface
        public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null) return;
            try {
                cm.setPrimaryClip(ClipData.newPlainText("ParaLine", text));
            } catch (RuntimeException ignored) {
                // text too large for the system clipboard
            }
        }

        @JavascriptInterface
        public String paste() {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            try {
                ClipData clip = cm == null ? null : cm.getPrimaryClip();
                if (clip == null || clip.getItemCount() == 0) return "";
                CharSequence t = clip.getItemAt(0).coerceToText(MainActivity.this);
                return t == null ? "" : t.toString();
            } catch (RuntimeException e) {
                return "";
            }
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, null));
                } catch (RuntimeException ignored) {
                    // nothing can receive the text
                }
            });
        }

        @JavascriptInterface
        public String takeIncoming() {
            String t = incoming;
            incoming = "";
            return t;
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> openExternally(url));
        }

        /** Sends one HTTPS request for the page and answers through window.__http(id, status, body). */
        @JavascriptInterface
        public void http(String id, String method, String url, String headersJson, String body) {
            new Thread(() -> {
                int status = 0;
                String text = "";
                HttpURLConnection c = null;
                try {
                    if (!url.startsWith(API_PREFIX)) throw new SecurityException("host not allowed");
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(180000);
                    c.setRequestMethod("POST".equals(method) ? "POST" : "GET");
                    JSONObject headers = new JSONObject(headersJson);
                    for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                        String k = it.next();
                        c.setRequestProperty(k, headers.getString(k));
                    }
                    if ("POST".equals(method)) {
                        byte[] out = body.getBytes(StandardCharsets.UTF_8);
                        c.setDoOutput(true);
                        c.setFixedLengthStreamingMode(out.length);
                        try (OutputStream os = c.getOutputStream()) {
                            os.write(out);
                        }
                    }
                    int code = c.getResponseCode();
                    InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    text = in == null ? "" : readAll(in);
                    status = code;
                } catch (Exception e) {
                    status = 0;
                    text = "";
                } finally {
                    if (c != null) c.disconnect();
                }
                String js = "window.__http&&window.__http(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")";
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript(js, null);
                });
            }, "paraline-http").start();
        }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        try (InputStream src = in; ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[16384];
            int n;
            while ((n = src.read(chunk)) > 0) buf.write(chunk, 0, n);
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
