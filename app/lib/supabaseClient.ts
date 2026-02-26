import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://LnjmRHROSduZ69vxp9cc6w.supabase.co"; // Project URL
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkd2psdHR2d3dhaHRoaXNtaml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjkwNjUsImV4cCI6MjA4NjgwNTA2NX0.Pbjfw_XE0qflanIs6eo0cDeeJPaS_dynpGnml2-_St4"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
