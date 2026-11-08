package com.tantanasuite.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.LinearLayout;
import android.widget.Toast;

/** Le système dessine les icônes, cette fenêtre dessine la surface derrière elles. */
public final class EcranTantana extends Activity {
    private static final Uri SITE = Uri.parse("https://tantana-suite.com");
    private LinearLayout frame;
    private WebView page;
    private WebMessagePort colors;
    private ValueCallback<Uri[]> files;
    private int topInset;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setStatusBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams layout = window.getAttributes();
            layout.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(layout);
        }
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        frame = new LinearLayout(this);
        page = new WebView(this);
        frame.addView(page, -1, -1);
        frame.setOnApplyWindowInsetsListener((v, insets) -> {
            topInset = insets.getSystemWindowInsetTop();
            frame.setPadding(insets.getSystemWindowInsetLeft(), 0,
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            updateInset();
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        paint("#F7F8F5");
        setContentView(frame);
        WebSettings settings = page.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + (ancienneEdition() ? " TantanaAndroidEssai/2" : " TantanaAndroid/2"));
        page.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!request.isForMainFrame() || trusted(url)) return false;
                if ("https".equals(url.getScheme()) || "mailto".equals(url.getScheme()) || "tel".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException e) { Toast.makeText(EcranTantana.this, "Lien indisponible", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (trusted(Uri.parse(url))) {
                    updateInset();
                    followTheme();
                }
            }
        });
        page.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (files != null) files.onReceiveValue(null);
                files = callback;
                try { startActivityForResult(params.createIntent(), 1); }
                catch (ActivityNotFoundException e) { files.onReceiveValue(null); files = null; }
                return true;
            }
        });
        if (!resumeGoogle(getIntent()) && (state == null || page.restoreState(state) == null)) page.loadUrl(SITE.toString());
    }

    private boolean ancienneEdition() { return "com.tantanasuite.app.essai".equals(getPackageName()); }

    private void updateInset() {
        if (page.getUrl() == null || !trusted(Uri.parse(page.getUrl()))) return;
        page.evaluateJavascript("document.documentElement.style.setProperty('--tantana-inset-native',("
            + topInset + "/window.devicePixelRatio)+'px');document.documentElement.dataset.barreNative='';", null);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        resumeGoogle(intent);
    }

    private boolean resumeGoogle(Intent intent) {
        Uri url = intent.getData();
        if (!Intent.ACTION_VIEW.equals(intent.getAction()) || url == null || !trusted(url)
            || !(ancienneEdition() ? "/android/retour.html" : "/android/connexion.html").equals(url.getEncodedPath())) return false;
        // Ne transmettre que le code PKCE. Le vérificateur reste dans le stockage de cette WebView.
        String code = url.getQueryParameter("code");
        if (code == null || !code.matches("[A-Za-z0-9_-]{16,256}")) {
            Toast.makeText(this, "Connexion interrompue. Vous pouvez réessayer.", Toast.LENGTH_LONG).show();
            return false;
        }
        setIntent(new Intent(this, EcranTantana.class));
        page.loadUrl(SITE.buildUpon().path("/").appendQueryParameter("code", code).build().toString());
        return true;
    }

    private boolean trusted(Uri url) {
        return SITE.getScheme().equals(url.getScheme()) && SITE.getHost().equals(url.getHost())
            && (url.getPort() == -1 || url.getPort() == 443);
    }

    private void paint(String hex) {
        if (hex == null || !hex.matches("#[a-fA-F0-9]{6}")) return;
        int color = Color.parseColor(hex);
        frame.setBackgroundColor(color);
        View decor = getWindow().getDecorView();
        int flags = decor.getSystemUiVisibility();
        decor.setSystemUiVisibility(Color.luminance(color) > 0.179f
            ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    }

    private void followTheme() {
        if (colors != null) colors.close();
        WebMessagePort[] channel = page.createWebMessageChannel();
        colors = channel[0];
        colors.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
            @Override public void onMessage(WebMessagePort port, WebMessage message) {
                if (port == colors) paint(message.getData());
            }
        });
        String script = "window.addEventListener('message',function init(e){"
            + "if(e.data!=='tantana-status' || !e.ports.length)return;"
            + "window.removeEventListener('message',init);const p=e.ports[0];"
            + "const sync=()=>{const m=document.querySelector('meta[name=theme-color]');"
            + "if(m)p.postMessage(m.content)};sync();"
            + "new MutationObserver(sync).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']});})";
        page.evaluateJavascript(script, ignored -> {
            if (!isDestroyed() && channel[0] == colors)
                page.postWebMessage(new WebMessage("tantana-status", new WebMessagePort[]{channel[1]}), SITE);
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 1 && files != null) {
            files.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            files = null;
        }
    }
    @Override public void onBackPressed() {
        if (page.canGoBack()) page.goBack(); else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        page.saveState(state);
    }
    @Override protected void onDestroy() {
        if (files != null) files.onReceiveValue(null);
        if (colors != null) colors.close();
        frame.removeView(page);
        page.destroy();
        super.onDestroy();
    }
}
