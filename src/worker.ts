import { db } from './db/index';
import { reportRequests } from './db/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function pollJobs() {
  console.log('Worker polling for jobs...');
  
  try {
    const pendingJobs = await db.select()
      .from(reportRequests)
      .where(eq(reportRequests.status, 'pending'));

    for (const job of pendingJobs) {
      console.log(`Processing job: ${job.id} for user: ${job.whatsappId}`);
      

      await db.update(reportRequests)
        .set({ status: 'processing' })
        .where(eq(reportRequests.id, job.id));

      try {

        console.log(`Generating report for ${job.id}...`);
        

        await new Promise(resolve => setTimeout(resolve, 2000));


        await db.update(reportRequests)
          .set({ 
            status: 'completed',
            filePath: `./reports/${job.id}.xlsx`
          })
          .where(eq(reportRequests.id, job.id));
          
        console.log(`Job ${job.id} completed.`);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        await db.update(reportRequests)
          .set({ status: 'failed' })
          .where(eq(reportRequests.id, job.id));
      }
    }
  } catch (error) {
    console.error('Error polling jobs:', error);
  }


  setTimeout(pollJobs, 10000);
}

console.log('Report Worker Service started.');
pollJobs();
