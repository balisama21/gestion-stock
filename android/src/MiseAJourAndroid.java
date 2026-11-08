package com.tantanasuite.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

final class MiseAJourAndroid {
    private static final String BASE = "https://tantana-suite.com/telechargements/";
    private static final String MIME = "application/vnd.android.package-archive";
    private static final long INTERVAL = 5 * 60_000L;
    private final Activity activity;
    private final DownloadManager downloads;
    private final SharedPreferences state;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = this::check;
    private boolean active, busy, dialogOpen;
    private long nextCheck;
    private int offered;
    private final int installed;

    MiseAJourAndroid(Activity activity) {
        this.activity = activity;
        downloads = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        state = activity.getSharedPreferences("android_updates", Context.MODE_PRIVATE);
        try {
            installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
        } catch (android.content.pm.PackageManager.NameNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }

    void resume() {
        active = true;
        if (state.getInt("code", 0) <= installed) clearPrevious();
        schedule(0);
    }

    void pause() {
        active = false;
        handler.removeCallbacks(tick);
    }

    private void schedule(long delay) {
        handler.removeCallbacks(tick);
        if (active) handler.postDelayed(tick, delay);
    }

    private void check() {
        if (!active || busy || dialogOpen || activity.isFinishing()) return;
        long id = state.getLong("download", -1);
        if (id >= 0) {
            if (state.getInt("code", 0) <= installed) clearDownload(id);
            else {
                pollDownload(id);
                return;
            }
        }
        long remaining = nextCheck - SystemClock.elapsedRealtime();
        if (remaining > 0) {
            schedule(remaining);
            return;
        }
        busy = true;
        new Thread(() -> {
            try {
                JSONObject release = release();
                int code = release.getInt("code");
                String name = release.getString("version");
                String hash = release.getString("sha256");
                if (!hash.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Empreinte invalide");
                handler.post(() -> {
                    busy = false;
                    if (!active) return;
                    nextCheck = SystemClock.elapsedRealtime() + INTERVAL;
                    if (code > installed && (offered != code || System.currentTimeMillis() >= remindAt)) {
                        offered = code;
                        remindAt = System.currentTimeMillis() + 24 * 60 * 60_000L;
                        prompt("Tantana " + name + " est disponible",
                            "Voulez-vous installer la mise à jour ?", "Mettre à jour", () -> download(code, hash));
                    } else schedule(INTERVAL);
                });
            } catch (Exception e) {
                Log.w("Tantana", "Catalogue des mises à jour indisponible", e);
                handler.post(() -> { busy = false; schedule(60_000); });
            }
        }, "Tantana-version").start();
    }

    private long remindAt;

    private JSONObject release() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(BASE + "versions.json").openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        try {
            if (connection.getResponseCode() != 200) throw new java.io.IOException("Catalogue indisponible");
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[1024];
                int n;
                while ((n = input.read(buffer)) != -1) {
                    if (bytes.size() + n > 16384) throw new java.io.IOException("Catalogue trop volumineux");
                    bytes.write(buffer, 0, n);
                }
                return new JSONObject(bytes.toString("UTF-8")).getJSONObject(activity.getPackageName());
            }
        } finally {
            connection.disconnect();
        }
    }

    private void prompt(String title, String message, String button, Runnable action) {
        dialogOpen = true;
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle(title).setMessage(message)
            .setPositiveButton(button, (d, w) -> action.run()).setNegativeButton("Plus tard", null).create();
        dialog.setOnDismissListener(d -> { dialogOpen = false; schedule(0); });
        dialog.show();
    }

    private void download(int code, String hash) {
        String edition = activity.getPackageName().endsWith(".essai") ? "tantana-essai" : "tantana";
        try {
            clearPrevious();
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(BASE + edition + ".apk?v=" + code))
                .setTitle("Mise à jour de Tantana").setMimeType(MIME);
            long id = downloads.enqueue(request);
            state.edit().putLong("download", id).putInt("code", code).putString("hash", hash).apply();
            Toast.makeText(activity, "Téléchargement de la mise à jour…", Toast.LENGTH_SHORT).show();
        } catch (RuntimeException e) { failed(-1, e); }
    }

    private void pollDownload(long id) {
        busy = true;
        new Thread(() -> {
            try {
                try (Cursor rows = downloads.query(new DownloadManager.Query().setFilterById(id))) {
                    if (rows == null || !rows.moveToFirst()) throw new java.io.IOException("Fichier absent");
                    int status = rows.getInt(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status == DownloadManager.STATUS_FAILED) throw new java.io.IOException("Téléchargement interrompu");
                    if (status != DownloadManager.STATUS_SUCCESSFUL) {
                        handler.post(() -> { busy = false; schedule(1500); });
                        return;
                    }
                }
                Uri uri = downloads.getUriForDownloadedFile(id);
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream input = activity.getContentResolver().openInputStream(uri)) {
                    byte[] buffer = new byte[16384];
                    int n;
                    while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
                if (!hex.toString().equals(state.getString("hash", ""))) throw new SecurityException("Empreinte incorrecte");
                handler.post(() -> { busy = false; if (active) install(id, uri); });
            } catch (Exception e) { handler.post(() -> { busy = false; failed(id, e); }); }
        }, "Tantana-apk").start();
    }

    private void install(long id, Uri uri) {
        try {
            if (!activity.getPackageManager().canRequestPackageInstalls()) {
                if (state.getBoolean("settingsOpened", false)) {
                    failed(id, new SecurityException("Autorisation refusée"));
                    return;
                }
                state.edit().putBoolean("settingsOpened", true).apply();
                Toast.makeText(activity, "Autorisez Tantana à installer la mise à jour, puis revenez dans l’application.", Toast.LENGTH_LONG).show();
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.fromParts("package", activity.getPackageName(), null)));
                return;
            }
            activity.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, MIME)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            // Keep the file readable until the installer has finished, including across process death.
            state.edit().putLong("previous", id).remove("download").remove("settingsOpened").apply();
            offered = state.getInt("code", installed);
            remindAt = System.currentTimeMillis() + 60 * 60_000L;
            nextCheck = SystemClock.elapsedRealtime() + INTERVAL;
            schedule(INTERVAL);
        } catch (RuntimeException e) { failed(id, e); }
    }

    private void clearDownload(long id) {
        if (id >= 0) downloads.remove(id);
        state.edit().remove("download").remove("settingsOpened").apply();
    }

    private void clearPrevious() {
        long previous = state.getLong("previous", -1);
        if (previous >= 0) {
            downloads.remove(previous);
            state.edit().remove("previous").apply();
        }
    }

    private void failed(long id, Exception error) {
        Log.w("Tantana", "Mise à jour interrompue", error);
        clearDownload(id);
        offered = 0;
        nextCheck = SystemClock.elapsedRealtime() + 60_000;
        if (active) Toast.makeText(activity, "Installation interrompue. Tantana vous proposera de réessayer.", Toast.LENGTH_LONG).show();
        schedule(60_000);
    }
}
