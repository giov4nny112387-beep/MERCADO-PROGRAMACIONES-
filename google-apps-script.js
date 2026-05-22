
/**
 * KRONOMERCADO - Google Apps Script de Sincronización
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Abre tu Google Sheets
 * 2. Ve a Extensiones → Apps Script
 * 3. Borra todo el contenido existente
 * 4. Pega TODO este código
 * 5. Guarda (Ctrl+S)
 * 6. Clic en "Implementar" → "Nueva implementación"
 * 7. Tipo: "Aplicación web"
 * 8. Ejecutar como: "Yo (tu cuenta)"
 * 9. Acceso: "Cualquier usuario (incluso anónimos)"
 * 10. Clic en "Implementar" y autoriza los permisos
 * 11. Copia la URL que aparece (termina en /exec)
 * 12. Pégala en KRONOMERCADO → Exportar → ⚙️ Configurar Sheets URL
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheetName || 'PROGRAMACION';
    var headers   = data.headers  || [];
    var rows      = data.rows     || [];
    var store     = data.store    || '';
    var timestamp = data.timestamp || new Date().toLocaleString('es-CO');

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    // Crear la pestaña si no existe
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Limpiar contenido anterior
    sheet.clearContents();
    sheet.clearFormats();

    // Fila de metadatos (fila 1)
    var metaValues = [
      ['KRONOMERCADO - ' + (data.metaTitle || 'Programación') + ' ' + store,
       'Actualizado: ' + timestamp,
       data.metaExtra || ('Trabajadores: ' + rows.length)]
    ];
    var metaRange = sheet.getRange(1, 1, 1, 3);
    metaRange.setValues(metaValues);
    metaRange.setBackground('#1a237e');
    metaRange.setFontColor('#ffffff');
    metaRange.setFontWeight('bold');
    metaRange.setFontSize(10);

    // Fila de encabezados (fila 2)
    if (headers.length > 0) {
      var headerRange = sheet.getRange(2, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setBackground('#e8eaf6');
      headerRange.setFontColor('#1a237e');
      headerRange.setFontWeight('bold');
      headerRange.setFontSize(9);
    }

    // Filas de datos (desde fila 3)
    if (rows.length > 0 && rows[0].length > 0) {
      var dataRange = sheet.getRange(3, 1, rows.length, rows[0].length);
      dataRange.setValues(rows);
      dataRange.setFontSize(8);

      // Colorear filas alternas para legibilidad
      for (var i = 0; i < rows.length; i++) {
        var rowRange = sheet.getRange(3 + i, 1, 1, rows[0].length);
        rowRange.setBackground(i % 2 === 0 ? '#ffffff' : '#f5f5f5');
      }

      // Congelar columnas fijas (PROG=4, DIST=1, etc.)
      var frozenCols = data.frozenCols || 4;
      sheet.setFrozenColumns(frozenCols);
      sheet.setFrozenRows(2);

      // Auto-ajustar primeras columnas fijas
      sheet.autoResizeColumns(1, Math.min(frozenCols, headers.length));
    }

    // Respuesta de éxito
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        rows: rows.length,
        sheet: sheetName,
        timestamp: timestamp
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  // Lectura de datos: ?action=getData&sheet=SCHED_AKCAN
  if (action === 'getData') {
    var sheetName = (e.parameter && e.parameter.sheet) || '';
    try {
      var ss    = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Pestaña no encontrada: ' + sheetName }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var rawData = sheet.getDataRange().getValues();

      // Convertir fechas de Google Sheets a strings YYYY-MM-DD
      var data = rawData.map(function(row) {
        return row.map(function(cell) {
          if (cell instanceof Date) {
            return Utilities.formatDate(cell, 'America/Bogota', 'yyyy-MM-dd');
          }
          return (cell === null || cell === undefined) ? '' : String(cell);
        });
      });

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, data: data, sheet: sheetName }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Health-check por defecto
  return ContentService
    .createTextOutput('KRONOMERCADO Sync OK - ' + new Date().toLocaleString('es-CO'))
    .setMimeType(ContentService.MimeType.TEXT);
}
