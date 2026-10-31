import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {executeWk100ResearchIntake} from '../_shared/wk100-research-intake-orchestrator.mjs';
import {createWk100ResearchIntakeHandler} from '../_shared/wk100-research-intake-handler.mjs';

// The same authenticated project-bound handler runs in tests and Production.
Deno.serve(createWk100ResearchIntakeHandler({
  createClient,executeWk100ResearchIntake,
  readEnv:name=>Deno.env.get(name),
}));
