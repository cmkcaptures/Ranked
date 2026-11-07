-- Ranked v31: hype collector runs every 5 minutes over 1/24 of the market (it now loads all 3,000+ characters). Run after v30.sql.
select cron.schedule('collect-hype', '*/5 * * * *', $q$
  select net.http_post(url := 'https://kzadwdqfpvxaaotbifvf.supabase.co/functions/v1/collect-hype',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from app_config where key = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 30000) $q$);
select jobname, schedule from cron.job where jobname = 'collect-hype';
