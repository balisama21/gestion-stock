package com.tantanasuite.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.provider.Settings;
import org.json.*;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.LinearLayout;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Button;
import android.graphics.Bitmap;
import android.widget.Toast;

/** Le système dessine les icônes, cette fenêtre dessine la surface derrière elles. */
public final class EcranTantana extends Activity {
    private static final Uri SITE = Uri.parse("https://tantana-suite.com");
    private FrameLayout frame;
    private LinearLayout connexion;
    private TextView messageConnexion;
    private Button reessayer;
    private boolean navigationEnErreur;
    private String destination = SITE.toString();
    private final Runnable attenteLongue = () -> {
        messageConnexion.setText("La connexion à Tantana prend du temps…");
        reessayer.setVisibility(View.VISIBLE);
    };
    private WebView page;
    private ExportAndroid exports;
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
        frame = new FrameLayout(this);
        exports = new ExportAndroid(this);
        page = new WebView(this);
        frame.addView(page, -1, -1);
        preparerConnexion();
        afficherChargement();
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
        settings.setUserAgentString(settings.getUserAgentString() + (ancienneEdition() ? " TantanaAndroidEssai/2" : " TantanaAndroid/2") + " TantanaExport/1");
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
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                if (!trusted(Uri.parse(url))) return;
                exports.annuler();
                if (colors != null) {
                    colors.close();
                    colors = null;
                }
                destination = url;
                navigationEnErreur = false;
                afficherChargement();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) echecConnexion(request);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) echecConnexion(request);
            }
            @Override public void onPageCommitVisible(WebView view, String url) {
                if (!navigationEnErreur && trusted(Uri.parse(url))) masquerConnexion();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!navigationEnErreur && trusted(Uri.parse(url))) {
                    masquerConnexion();
                    updateInset();
                    followTheme();
                    if ("1".equals(Uri.parse(url).getQueryParameter("exportsAndroid")))
                        getPreferences(MODE_PRIVATE).edit().putBoolean("exportsAndroid", true).apply();
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
        if (!resumeGoogle(getIntent()) && (state == null || page.restoreState(state) == null)) {
            // La première ouverture après mise à jour doit contourner l’ancien accueil en cache.
            boolean initialise = getPreferences(MODE_PRIVATE).getBoolean("exportsAndroid", false);
            page.loadUrl(initialise ? SITE.toString() : SITE.buildUpon().path("/").appendQueryParameter("exportsAndroid", "1").build().toString());
        }
    }

    private void preparerConnexion() {
        connexion = new LinearLayout(this);
        connexion.setOrientation(LinearLayout.VERTICAL);
        connexion.setGravity(Gravity.CENTER);
        int marge = (int) (24 * getResources().getDisplayMetrics().density);
        connexion.setPadding(marge, marge, marge, marge);
        connexion.setBackgroundColor(Color.parseColor("#F7F8F5"));
        connexion.setClickable(true);
        messageConnexion = new TextView(this);
        messageConnexion.setTextSize(18);
        messageConnexion.setGravity(Gravity.CENTER);
        messageConnexion.setTextColor(Color.parseColor("#243B31"));
        messageConnexion.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        connexion.addView(messageConnexion);
        reessayer = new Button(this);
        reessayer.setText("Réessayer");
        reessayer.setOnClickListener(v -> {
            afficherChargement();
            page.loadUrl(destination);
        });
        connexion.addView(reessayer);
        frame.addView(connexion, -1, -1);
    }

    private void afficherChargement() {
        connexion.removeCallbacks(attenteLongue);
        messageConnexion.setText("Ouverture de Tantana…");
        reessayer.setVisibility(View.GONE);
        connexion.setVisibility(View.VISIBLE);
        connexion.postDelayed(attenteLongue, 3000);
    }

    private void masquerConnexion() {
        connexion.removeCallbacks(attenteLongue);
        connexion.setVisibility(View.GONE);
    }

    private void echecConnexion(WebResourceRequest request) {
        navigationEnErreur = true;
        destination = trusted(request.getUrl()) && "GET".equals(request.getMethod())
            ? request.getUrl().toString() : SITE.toString();
        connexion.removeCallbacks(attenteLongue);
        messageConnexion.setText("Impossible de joindre Tantana. Vérifiez votre connexion Internet, puis réessayez.");
        reessayer.setVisibility(View.VISIBLE);
        connexion.setVisibility(View.VISIBLE);
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

    private void handleReminder(String data) {
        try {
            JSONObject msg = new JSONObject(data);
            String action = msg.getString("action");
            if ("sync".equals(action)) RappelsAndroid.replace(this, msg.getJSONArray("rows"));
            if ("clear".equals(action)) {
                RappelsAndroid.replace(this, new JSONArray());
                getSystemService(NotificationManager.class).cancelAll();
            }
            if ("disable".equals(action)) {
                RappelsAndroid.prefs(this).edit().putBoolean("enabled", false).apply();
                RappelsAndroid.cancel(this);
            }
            if ("enable".equals(action)) {
                RappelsAndroid.prefs(this).edit().putBoolean("enabled", true).apply();
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED && !RappelsAndroid.prefs(this).getBoolean("asked", false)) {
                    RappelsAndroid.prefs(this).edit().putBoolean("asked", true).apply();
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 2);
                } else if (!RappelsAndroid.notifications(this)) {
                    Intent settings = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, RappelsAndroid.CHANNEL);
                    if (!getSystemService(NotificationManager.class).areNotificationsEnabled())
                        settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(settings);
                } else if (!RappelsAndroid.exact(this)) {
                    startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                } else RappelsAndroid.scheduleAll(this);
            }
            if (!"sync".equals(action)) reminderStatus();
        } catch (JSONException | SecurityException | ActivityNotFoundException e) {
            Toast.makeText(this, "Vérifiez les autorisations de rappel dans Android.", Toast.LENGTH_LONG).show();
        }
    }

    private void reminderStatus() {
        if (colors == null) return;
        String status = !RappelsAndroid.prefs(this).getBoolean("enabled", false) ? "off"
            : !RappelsAndroid.notifications(this) ? "notifications"
            : !RappelsAndroid.exact(this) ? "alarms" : "ready";
        colors.postMessage(new WebMessage(status));
    }

    @Override protected void onResume() {
        super.onResume();
        refreshReminders();
    }

    private void refreshReminders() {
        try { RappelsAndroid.scheduleAll(this); }
        catch (JSONException | SecurityException e) { android.util.Log.w("Tantana", "Synchronisation des rappels indisponible", e); }
        reminderStatus();
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 2) refreshReminders();
    }

    private void followTheme() {
        if (colors != null) return;
        WebMessagePort[] channel = page.createWebMessageChannel();
        colors = channel[0];
        colors.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
            @Override public void onMessage(WebMessagePort port, WebMessage message) {
                if (port != colors || message.getData() == null) return;
                String data = message.getData();
                if (data.startsWith("export:") && page.getUrl() != null && trusted(Uri.parse(page.getUrl()))) exports.recevoir(port, data.substring(7));
                else if (data.startsWith("{")) handleReminder(data);
                else paint(data);
            }
        });
        String script = "window.addEventListener('message',function init(e){"
            + "if(e.data!=='tantana-status' || !e.ports.length)return;"
            + "window.removeEventListener('message',init);const p=e.ports[0];"
            + "window.tantanaRappels=m=>p.postMessage(JSON.stringify(m));"
            + "window.tantanaExport=m=>p.postMessage('export:'+JSON.stringify(m));"
            + "p.onmessage=e=>{if(e.data.startsWith('export:'))window.dispatchEvent(new CustomEvent('tantana-export-reponse',{detail:JSON.parse(e.data.slice(7))}));"
            + "else window.dispatchEvent(new CustomEvent('tantana-rappels-etat',{detail:e.data}));};"
            + "window.dispatchEvent(new Event('tantana-rappels-pret'));"
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
        if (request == ExportAndroid.CHOISIR) {
            exports.destination(result == RESULT_OK && data != null ? data.getData() : null);
            return;
        }
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
        exports.fermer();
        connexion.removeCallbacks(attenteLongue);
        frame.removeView(page);
        page.destroy();
        super.onDestroy();
    }
}
