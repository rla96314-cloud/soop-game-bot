// ── Drive 이미지 저장 헬퍼 ───────────────────────────────────────────────────
function saveBossImageToDrive_(phase, dataUrl) {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const match = parts[0].match(/:(.*?);/);
  if (!match) return null;
  const mimeType = match[1];
  const ext = mimeType.split('/')[1] || 'png';
  const blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeType, 'boss-' + phase + '.' + ext);

  let folder;
  const folders = DriveApp.getFoldersByName('SOOP-Game-Bot-Images');
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('SOOP-Game-Bot-Images');
  }

  // 기존 같은 이름 파일 삭제
  const existing = folder.getFilesByName('boss-' + phase + '.' + ext);
  while (existing.hasNext()) existing.next().setTrashed(true);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    // ── 보스 설정 저장 ───────────────────────────────────────
    if (data.action === 'saveSettings') {
      let sheet = ss.getSheetByName('보스 설정');
      if (!sheet) sheet = ss.insertSheet('보스 설정');
      sheet.clearContents();
      const cfg = data.settings || {};
      const rows = [
        ['bossName',         cfg.bossName         ?? '보스'],
        ['maxHp',            cfg.maxHp            ?? 100000],
        ['balloonThreshold', cfg.balloonThreshold ?? 100],
        ['damagePerDot',     cfg.damagePerDot     ?? 100],
        ['phase2HpPercent',  cfg.phase2HpPercent  ?? 50],
        ['enabled',          String(cfg.enabled   ?? true)],
        ['critEnabled',      String(cfg.critEnabled ?? true)],
        ['critChance',       cfg.critChance       ?? 0.15],
        ['critMultiplier',   cfg.critMultiplier   ?? 2],
        ['lootItems',        JSON.stringify(cfg.lootItems ?? [])],
      ];

      // 이미지가 포함된 경우 Drive에 업로드하고 URL 저장
      if (data.images) {
        for (const phase of ['phase1', 'phase2', 'success']) {
          if (data.images[phase]) {
            const url = saveBossImageToDrive_(phase, data.images[phase]);
            if (url) rows.push([phase + 'ImageUrl', url]);
          }
        }
      }

      sheet.getRange(1, 1, rows.length, 2).setValues(rows);
      sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');
      sheet.autoResizeColumns(1, 2);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── 보스 설정 불러오기 ───────────────────────────────────
    if (data.action === 'getSettings') {
      const sheet = ss.getSheetByName('보스 설정');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: '보스 설정 탭 없음' }))
        .setMimeType(ContentService.MimeType.JSON);
      const rows = sheet.getDataRange().getValues();
      const cfg  = {};
      rows.forEach(([k, v]) => { if (k) cfg[String(k)] = v; });
      if (cfg.maxHp            !== undefined) cfg.maxHp            = Number(cfg.maxHp);
      if (cfg.balloonThreshold !== undefined) cfg.balloonThreshold = Number(cfg.balloonThreshold);
      if (cfg.damagePerDot     !== undefined) cfg.damagePerDot     = Number(cfg.damagePerDot);
      if (cfg.phase2HpPercent  !== undefined) cfg.phase2HpPercent  = Number(cfg.phase2HpPercent);
      if (cfg.critChance       !== undefined) cfg.critChance       = Number(cfg.critChance);
      if (cfg.critMultiplier   !== undefined) cfg.critMultiplier   = Number(cfg.critMultiplier);
      if (cfg.enabled          !== undefined) cfg.enabled          = cfg.enabled === 'true' || cfg.enabled === true;
      if (cfg.critEnabled      !== undefined) cfg.critEnabled      = cfg.critEnabled === 'true' || cfg.critEnabled === true;
      if (cfg.lootItems        !== undefined) {
        try { cfg.lootItems = JSON.parse(cfg.lootItems); } catch { cfg.lootItems = []; }
      }

      // 이미지 URL 분리해서 반환
      const imageUrls = {};
      for (const phase of ['phase1', 'phase2', 'success']) {
        const key = phase + 'ImageUrl';
        if (cfg[key]) { imageUrls[phase] = cfg[key]; delete cfg[key]; }
      }

      return ContentService.createTextOutput(JSON.stringify({ ok: true, settings: cfg, imageUrls }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── 레이드 기록 ──────────────────────────────────────────
    const now   = new Date();
    const name  = Utilities.formatDate(now, 'Asia/Seoul', 'MM-dd HH:mm') + ' ' + (data.bossName || '보스');
    const sheet = ss.insertSheet(name, 0);

    let r = 1;
    sheet.getRange(r, 1, 1, 5).merge().setValue('레이드 결과 — ' + (data.bossName || '보스'));
    sheet.getRange(r, 1).setFontSize(14).setFontWeight('bold').setBackground('#c0392b').setFontColor('#fff');
    r++;

    [['보스', data.bossName || ''], ['최대 HP', data.maxHp || ''], ['레이드 시각', data.raidedAt || '']].forEach(row => {
      sheet.getRange(r, 1, 1, 2).setValues([row]);
      sheet.getRange(r, 1).setFontWeight('bold');
      r++;
    });
    r++;

    sheet.getRange(r, 1, 1, 5).setValues([['참여자', '총 데미지', '공격 횟수', '크리티컬', '기여도(%)']]);
    sheet.getRange(r, 1, 1, 5).setFontWeight('bold').setBackground('#333').setFontColor('#fff');
    r++;

    (data.participants || []).forEach((p, i) => {
      sheet.getRange(r, 1, 1, 5).setValues([[p.user, p.totalDamage, p.attackCount, p.critCount, p.contributionRate]]);
      sheet.getRange(r, 1, 1, 5).setBackground(i % 2 === 0 ? '#fff' : '#f5f5f5');
      r++;
    });

    if (data.lootResults && data.lootResults.length) {
      r++;
      sheet.getRange(r, 1, 1, 4).merge().setValue('전리품 결과');
      sheet.getRange(r, 1).setFontWeight('bold').setBackground('#c0392b').setFontColor('#fff');
      r++;
      sheet.getRange(r, 1, 1, 4).setValues([['순번', '당첨자', '상품명', '기여도(%)']]);
      sheet.getRange(r, 1, 1, 4).setFontWeight('bold').setBackground('#333').setFontColor('#fff');
      r++;
      data.lootResults.forEach((l, i) => {
        sheet.getRange(r, 1, 1, 4).setValues([[l.rank, l.user, l.item, l.contributionRate]]);
        sheet.getRange(r, 1, 1, 4).setBackground(i % 2 === 0 ? '#fff' : '#f5f5f5');
        r++;
      });
    }

    sheet.autoResizeColumns(1, 5);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, sheet: name }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
