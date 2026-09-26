// Root-only operational diagnostics. Prints no customer data or credentials.
import { createRequire } from 'node:module';
import { createHash,createHmac,randomUUID } from 'node:crypto';
if(process.getuid?.()!==0) throw new Error('root_required');
const id=Number(process.argv[2]);
if(!Number.isSafeInteger(id)||id<=0)throw new Error('booking_id_required');
const {Pool}=createRequire(`${process.cwd()}/package.json`)('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
try {
  const rows=(await pool.query(`select q.status,q.last_error,q.ro_order_id,q.remote_checked_at,s.status_name,s.amount_cents,s.fixed_price,s.remote_modified_at from roapp_sync_queue q left join roapp_order_state s using(booking_id) where q.booking_id=$1`,[id])).rows;
  console.log('local_state',JSON.stringify(rows));
  console.log('notifications',JSON.stringify((await pool.query('select channel,status,event_type,provider_message_id from outbound_queue where booking_id=$1',[id])).rows));
  console.log('photos',JSON.stringify((await pool.query('select count(*),upload_state from booking_photos where booking_id=$1 group by upload_state',[id])).rows));
  const orderId=rows[0]?.ro_order_id;
  if(orderId){
    const response=await fetch(`https://api.roapp.io/v2/orders/${orderId}`,{headers:{Authorization:`Bearer ${process.env.ROAPP_API_KEY}`}});
    const payload=await response.json();const order=payload.data||payload;
    console.log('remote_state',JSON.stringify({http:response.status,id:order.id,status:order.status,total:order.total,modified_at:order.modified_at,scheduled_for:order.scheduled_for}));
    if(process.argv.includes('--test-callback')){
      const eventId=randomUUID();
      const signature=createHmac('sha256',process.env.ROAPP_WEBHOOK_SECRET).update(eventId).digest('hex');
      const callback=await fetch('https://white-gloss.de/api/ro-callback',{method:'POST',headers:{'content-type':'application/json','x-signature':signature},body:JSON.stringify({id:eventId,event_name:'Order.Status.Changed',context:{object_id:orderId,object_type:'order'}})});
      console.log('callback_response',callback.status,(await callback.text()).slice(0,100));
    }
  }
  console.log('configuration',JSON.stringify({mode:process.env.BOOKING_OPERATIONS,approvedStatus:process.env.ROAPP_APPROVED_STATUS_ID,webhookSecretLength:process.env.ROAPP_WEBHOOK_SECRET?.length,webhookFingerprint:createHash('sha256').update(process.env.ROAPP_WEBHOOK_SECRET||'').digest('hex').slice(0,12)}));
} finally {await pool.end();}
