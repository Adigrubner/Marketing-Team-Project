// הידיים של האנליסט - שליפת נתוני ביצועים מ-Meta. קריאה בלבד, בטוח תמיד.
// שימוש:
//   node tools/meta-report.js                    ← כל הקמפיינים (30 יום אחרונים)
//   node tools/meta-report.js --days 7           ← טווח אחר
//   node tools/meta-report.js --json             ← פלט JSON (בשביל שהאנליסט יבנה דשבורד)
import { loadEnv, ok, bad, info, title } from './lib/env.js';
import { requireMetaEnv, graphGet, adAccountPath } from './lib/meta.js';

loadEnv();
try { requireMetaEnv(); } catch (e) { bad(e.message); process.exit(1); }

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? Math.max(1, Number(args[daysIdx + 1]) || 30) : 30;

const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const until = new Date().toISOString().slice(0, 10);

try {
  const res = await graphGet(adAccountPath('insights'), {
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    fields: 'campaign_name,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type',
    limit: 50,
  });
  const rows = (res.data || []).map((d) => {
    const leadAction = (d.actions || []).find((a) => a.action_type === 'lead' || a.action_type === 'onsite_web_lead');
    const cplAction = (d.cost_per_action_type || []).find((a) => a.action_type === 'lead' || a.action_type === 'onsite_web_lead');
    return {
      campaign: d.campaign_name,
      spend_ils: Number(d.spend || 0),
      impressions: Number(d.impressions || 0),
      reach: Number(d.reach || 0),
      clicks: Number(d.clicks || 0),
      ctr_pct: Number(d.ctr || 0),
      cpc_ils: Number(d.cpc || 0),
      leads: leadAction ? Number(leadAction.value) : 0,
      cost_per_lead_ils: cplAction ? Number(cplAction.value) : null,
    };
  });

  if (asJson) {
    console.log(JSON.stringify({ since, until, campaigns: rows }, null, 2));
  } else {
    title(`דוח ביצועים · ${since} עד ${until}`);
    if (!rows.length) info('אין עדיין נתונים בטווח הזה (קמפיין מושהה או חדש = 0 הוצאה, וזה תקין).');
    for (const r of rows) {
      console.log(`\n📣 ${r.campaign}`);
      info(`הוצאה: ${r.spend_ils.toFixed(2)}₪ · חשיפות: ${r.impressions} · קליקים: ${r.clicks}`);
      info(`CTR: ${r.ctr_pct.toFixed(2)}% · CPC: ${r.cpc_ils.toFixed(2)}₪ · לידים: ${r.leads}` +
        (r.cost_per_lead_ils != null ? ` · עלות לליד: ${r.cost_per_lead_ils.toFixed(2)}₪` : ''));
    }
    console.log('');
    ok('טיפ: בשביל דשבורד מעוצב, בקשו מהאנליסט "תבנה לי דוח HTML מהנתונים" (הוא ירוץ עם --json)');
  }
} catch (e) {
  bad(`שליפת הדוח נכשלה: ${e.message}`);
  console.log('טיפ: הריצו npm run doctor, או הדביקו את השגיאה לקלוד.');
  process.exit(1);
}
