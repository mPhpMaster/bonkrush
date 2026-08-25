extends Node

# ── Supabase configuration ──────────────────────────────────────────────────
# Paste your project URL and anon key from the Supabase dashboard.
# NEVER put the service_role key here.
const SUPABASE_URL: String = "https://nkmkljpbmuypasjdvxtv.supabase.co"
const SUPABASE_ANON_KEY: String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbWtsanBibXV5cGFzamR2eHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzE3MjAsImV4cCI6MjEwMTYwNzcyMH0.SWuD75lFmE2hTbt109WDJZX5_xjCfljPILr5L66gZug"

# REST helpers
const REST_URL: String = SUPABASE_URL + "/rest/v1"
const AUTH_URL: String = SUPABASE_URL + "/auth/v1"
const RPC_URL:  String = SUPABASE_URL + "/rest/v1/rpc"
