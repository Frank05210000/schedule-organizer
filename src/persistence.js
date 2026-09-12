import {doc,runTransaction,serverTimestamp,getDocFromServer} from 'firebase/firestore';
export async function saveAvailability(db,mid,week,version) {
  const ref=doc(db,'availability',mid);
  try {
    await runTransaction(db,async tx=>{
      const current=await tx.get(ref);
      if((current.data()?.version || 0)!==version)throw Error('conflict');
      tx.set(ref,{week,version:version+1,updatedAt:serverTimestamp()});
    });
  } catch(e) {
    // Rules can reject a racing transaction before the SDK retries it.
    if(e.message==='conflict' || e.code==='permission-denied') {
      const current=await getDocFromServer(ref);
      if((current.data()?.version || 0)!==version) {
        const conflict=Error('conflict');conflict.current=current.data();throw conflict;
      }
    }
    throw e;
  }
}
