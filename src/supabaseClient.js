import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://omfkfllyquidkepxruhq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZmtmbGx5cXVpZGtlcHhydWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDM4NDMsImV4cCI6MjEwMzkxOTg0M30.HusUqzE4npwMIzZ_lxPGJ-PeRBbvYvWlCPl0cqjGeFc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export const TABLES = ["buildings", "apartments", "tenants", "payments", "maintenances", "syndicCharges"];
