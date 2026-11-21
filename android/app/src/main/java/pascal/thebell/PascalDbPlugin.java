package pascal.thebell;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.sqlite.SQLiteStatement;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 轻量 SQLite 桥：只负责执行 SQL 与返回行数据。
 * 表结构与业务逻辑都放在 TypeScript 层，便于迁移和导入导出。
 */
@CapacitorPlugin(name = "PascalDb")
public class PascalDbPlugin extends Plugin {

    private SQLiteDatabase db;

    private static class DbHelper extends SQLiteOpenHelper {
        DbHelper(Context context) {
            super(context, "thebell.db", null, 1);
        }

        @Override
        public void onCreate(SQLiteDatabase database) {
            // 表结构由 JS 层初始化，方便版本演进。
        }

        @Override
        public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
            // Dev0.1 暂无迁移。
        }
    }

    @Override
    public void load() {
        db = new DbHelper(getContext()).getWritableDatabase();
    }

    @Override
    protected void handleOnDestroy() {
        if (db != null && db.isOpen()) db.close();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void query(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null || sql.trim().isEmpty()) {
            call.reject("sql is required");
            return;
        }
        Cursor cursor = null;
        try {
            cursor = db.rawQuery(sql, stringArgs(argsOf(call.getArray("args"))));
            String[] columns = cursor.getColumnNames();
            JSArray rows = new JSArray();

            while (cursor.moveToNext()) {
                JSObject row = new JSObject();
                for (int i = 0; i < columns.length; i++) {
                    switch (cursor.getType(i)) {
                        case Cursor.FIELD_TYPE_INTEGER:
                            row.put(columns[i], cursor.getLong(i));
                            break;
                        case Cursor.FIELD_TYPE_FLOAT:
                            row.put(columns[i], cursor.getDouble(i));
                            break;
                        case Cursor.FIELD_TYPE_NULL:
                            row.put(columns[i], JSONObject.NULL);
                            break;
                        default:
                            row.put(columns[i], cursor.getString(i));
                            break;
                    }
                }
                rows.put(row);
            }

            JSObject result = new JSObject();
            result.put("rows", rows);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    @PluginMethod
    public void run(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null || sql.trim().isEmpty()) {
            call.reject("sql is required");
            return;
        }
        try {
            execute(sql, argsOf(call.getArray("args")));
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void transaction(PluginCall call) {
        JSArray statements = call.getArray("statements");
        if (statements == null) {
            call.reject("statements is required");
            return;
        }
        db.beginTransaction();
        try {
            for (int i = 0; i < statements.length(); i++) {
                JSONObject statement = statements.getJSONObject(i);
                String sql = statement.optString("sql", "");
                if (sql.trim().isEmpty()) throw new Exception("statement.sql is required");
                Object[] args = argsOf(statement.optJSONArray("args"));
                execute(sql, args);
            }
            db.setTransactionSuccessful();
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        } finally {
            db.endTransaction();
        }
    }

    private void execute(String sql, Object[] args) {
        SQLiteStatement statement = db.compileStatement(sql);
        try {
            bind(statement, args);
            statement.execute();
        } finally {
            statement.close();
        }
    }

    private static Object[] argsOf(JSONArray array) {
        if (array == null) return new Object[0];
        List<Object> values = new ArrayList<>(array.length());
        for (int i = 0; i < array.length(); i++) {
            values.add(array.opt(i));
        }
        return values.toArray();
    }

    private static void bind(SQLiteStatement statement, Object[] args) {
        for (int i = 0; i < args.length; i++) {
            Object value = args[i];
            int index = i + 1;
            if (value == null || value == JSONObject.NULL) {
                statement.bindNull(index);
            } else if (value instanceof Boolean) {
                statement.bindLong(index, ((Boolean) value) ? 1 : 0);
            } else if (value instanceof Double || value instanceof Float) {
                statement.bindDouble(index, ((Number) value).doubleValue());
            } else if (value instanceof Number) {
                statement.bindLong(index, ((Number) value).longValue());
            } else {
                statement.bindString(index, value.toString());
            }
        }
    }

    private static String[] stringArgs(Object[] args) {
        String[] values = new String[args.length];
        for (int i = 0; i < args.length; i++) {
            Object value = args[i];
            values[i] =
                (value == null || value == JSONObject.NULL) ? null : String.valueOf(value);
        }
        return values;
    }
}
