import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ktscqzszscxeloihotdm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0c2NxenN6c2N4ZWxvaWhvdGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzI2ODAsImV4cCI6MjA4NDEwODY4MH0.8eRFLZoEnyHmZ61KTrGoLOgPJ06JqnjtTGB4V-lo5nA'

export const supabase = createClient(supabaseUrl, supabaseKey)
