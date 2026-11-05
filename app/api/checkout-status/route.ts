import { configuration } from '../../../lib/commerce.mjs';
export const dynamic='force-dynamic';
export function GET(){return Response.json({enabled:configuration().enabled},{headers:{'Cache-Control':'no-store'}});}
