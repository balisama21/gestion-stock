package com.tantanasuite.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.widget.Toast;
import org.json.JSONObject;
import org.json.JSONException;
import java.io.*;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Un seul export à la fois. Les blocs et la copie finale sont écrits hors du fil UI. */
final class ExportAndroid {
    static final int CHOISIR = 93;
    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile Transfert courant;
    private boolean choixOuvert;

    private static final class Transfert {
        final String id, nom, mime;
        final long taille;
        final WebMessagePort port;
        File fichier;
        OutputStream flux;
        long recu;
        boolean complet;
        Transfert(JSONObject message, WebMessagePort port) throws Exception {
            this.port = port;
            id = message.getString("id");
            taille = message.getLong("taille");
            nom = message.getString("nom").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (nom.isEmpty() || nom.length() > 240 || taille < 0) throw new IOException();
            String ext = nom.substring(nom.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            switch (ext) {
                case "pdf": mime = "application/pdf"; break;
                case "png": mime = "image/png"; break;
                case "jpg": case "jpeg": mime = "image/jpeg"; break;
                case "zip": mime = "application/zip"; break;
                case "csv": mime = "text/csv"; break;
                case "xlsx": mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; break;
                default: throw new IOException();
            }
        }
        void nettoyer() {
            if (flux != null) try { flux.close(); } catch (IOException ignored) {}
            if (fichier != null) fichier.delete();
        }
    }

    ExportAndroid(Activity activity) {
        this.activity = activity;
        io.execute(() -> {
            File[] anciens = activity.getCacheDir().listFiles((d,n) -> n.startsWith("export-tantana-"));
            if (anciens != null) for (File f : anciens)
                if (f.lastModified() < System.currentTimeMillis() - 86400000L) f.delete();
        });
    }

    private void repondre(WebMessagePort port, String id, String erreur) {
        try {
            JSONObject reponse = new JSONObject().put("id", id);
            if (erreur != null) reponse.put("erreur", erreur);
            port.postMessage(new WebMessage("export:" + reponse));
        } catch (IllegalStateException | JSONException ignored) {}
    }

    void recevoir(WebMessagePort port, String contenu) {
        String id = "";
        try {
            JSONObject message = new JSONObject(contenu);
            id = message.getString("id");
            String action = message.getString("action");
            if ("debut".equals(action)) {
                if (courant != null || choixOuvert) throw new IOException();
                courant = new Transfert(message, port);
            }
            Transfert t = courant;
            if (t == null || !t.id.equals(id) || t.port != port) return;
            if ("abandon".equals(action)) { annuler(); return; }
            io.execute(() -> {
                if (courant != t) return;
                try {
                    switch (action) {
                        case "debut":
                            t.fichier = File.createTempFile("export-tantana-", ".tmp", activity.getCacheDir());
                            t.flux = new BufferedOutputStream(new FileOutputStream(t.fichier));
                            break;
                        case "bloc":
                            String base64 = message.getString("donnees");
                            if (base64.length() > 65536 || t.complet) throw new IOException();
                            byte[] bloc = Base64.decode(base64, Base64.NO_WRAP);
                            if (t.recu + bloc.length > t.taille) throw new IOException();
                            t.flux.write(bloc);
                            t.recu += bloc.length;
                            break;
                        case "terminer":
                            if (t.recu != t.taille || t.complet) throw new IOException();
                            t.flux.close();
                            t.flux = null;
                            t.complet = true;
                            ui.post(() -> choisir(t));
                            return;
                        default: throw new IOException();
                    }
                    ui.post(() -> { if (courant == t) repondre(port, t.id, null); });
                } catch (Exception e) { ui.post(() -> finir(t, "Impossible de préparer le fichier.")); }
            });
        } catch (Exception e) { repondre(port, id, "Impossible de commencer cet enregistrement."); }
    }

    private void choisir(Transfert t) {
        if (courant != t) return;
        Intent choix = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(t.mime).putExtra(Intent.EXTRA_TITLE, t.nom);
        try {
            activity.startActivityForResult(choix, CHOISIR);
            choixOuvert = true;
        } catch (RuntimeException e) { finir(t, "Le sélecteur de fichiers Android est indisponible."); }
    }

    void destination(Uri uri) {
        choixOuvert = false;
        Transfert t = courant;
        if (t == null) return;
        if (uri == null) { finir(t, "Enregistrement annulé."); return; }
        io.execute(() -> {
            try (InputStream source = new FileInputStream(t.fichier);
                 OutputStream cible = activity.getContentResolver().openOutputStream(uri, "wt")) {
                if (cible == null) throw new IOException();
                byte[] tampon = new byte[65536];
                int n;
                while ((n = source.read(tampon)) != -1) cible.write(tampon, 0, n);
            } catch (Exception e) {
                ui.post(() -> finir(t, "Android n’a pas pu enregistrer le fichier dans ce dossier."));
                return;
            }
            ui.post(() -> finir(t, null));
        });
    }

    private void finir(Transfert t, String erreur) {
        if (courant != t) return;
        repondre(t.port, t.id, erreur);
        if (erreur == null) Toast.makeText(activity, "Fichier enregistré", Toast.LENGTH_SHORT).show();
        annuler();
    }
    void annuler() {
        Transfert t = courant;
        courant = null;
        if (t != null) io.execute(t::nettoyer);
    }
    void fermer() { annuler(); io.shutdown(); }
}
