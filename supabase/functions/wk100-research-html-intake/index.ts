import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {executeWk100HtmlResearchIntake} from '../_shared/wk100-research-html-intake-orchestrator.mjs';
import {createWk100HtmlResearchIntakeHandler} from '../_shared/wk100-research-html-intake-handler.mjs';

// Separate protected HTML path. Keep the Shazam CSV function unchanged.
Deno.serve(createWk100HtmlResearchIntakeHandler({
  createClient,executeWk100HtmlResearchIntake,
  readEnv:(name: string)=>Deno.env.get(name),
}));
