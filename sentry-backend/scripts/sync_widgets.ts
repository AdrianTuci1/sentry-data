import { deployWidgetsToR2 } from './lib/widget_deploy';

async function syncWidgets() {
    console.log('══════════════════════════════════════════');
    console.log('  DEPLOYING DISCOVERY WIDGETS TO R2');
    console.log('══════════════════════════════════════════\n');

    try {
        await deployWidgetsToR2();
        console.log('\n[SUCCESS] Discovery widgets deployed to R2.');
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncWidgets();
