package be.sportgreenmoove.qa.connectivity;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.widget.TextView;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URL;

public final class ProbeActivity extends Activity {
    private static final String HOST = "127.0.0.1";
    private static final int PORT = 9000;
    private static final String MARKER = "sgm-private-socket-probe-v1";

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        TextView text = new TextView(this);
        text.setPadding(32, 64, 32, 32); text.setTextSize(20);
        text.setText("Test de connexion\nEn cours"); setContentView(text);
        new Thread(() -> {
            long started = SystemClock.elapsedRealtime();
            String http = checkHttp(), socket = checkSocket();
            long duration = SystemClock.elapsedRealtime() - started;
            runOnUiThread(() -> text.setText("Test de connexion\n\nHTTP: " + http +
                "\n\nSocket: " + socket + "\n\nDuree: " + duration + " ms\n\nAucun compte utilise"));
        }, "isolated-connection-probe").start();
    }

    private static String checkHttp() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL("http://" + HOST + ":" + PORT + "/sgm-socket-probe-20261025").openConnection();
            connection.setConnectTimeout(5_000); connection.setReadTimeout(5_000);
            connection.setInstanceFollowRedirects(false);
            return connection.getResponseCode() == 204 && MARKER.equals(connection.getHeaderField("X-SGM-Probe"))
                ? "VERIFIED_204" : "UNEXPECTED_RESPONSE";
        } catch (Exception ignored) { return "FAILED"; }
        finally { if (connection != null) connection.disconnect(); }
    }

    private static String checkSocket() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(HOST, PORT), 3_000);
            return "CONNECTED_ORIGIN_UNVERIFIED";
        } catch (ConnectException error) {
            for (Throwable cause = error; cause != null; cause = cause.getCause())
                if (cause instanceof ErrnoException && ((ErrnoException) cause).errno == OsConstants.ECONNREFUSED)
                    return "ECONNREFUSED";
            return "CONNECT_EXCEPTION";
        } catch (SocketTimeoutException ignored) { return "TIMED_OUT"; }
        catch (Exception ignored) { return "FAILED"; }
    }
}
