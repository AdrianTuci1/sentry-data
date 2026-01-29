
import { aiService } from './index';

async function verifyRefactor() {
    console.log("Verifying Refactor...");

    if (typeof aiService.validateLogic === 'function') {
        console.log("✅ validateLogic exists");
    } else {
        console.error("❌ validateLogic MISSING");
    }

    if (typeof aiService.runAutoML === 'function') {
        console.log("✅ runAutoML exists");
    } else {
        console.error("❌ runAutoML MISSING");
    }

    if (typeof aiService.generateGoldLayer === 'function') {
        console.log("✅ generateGoldLayer exists");
    } else {
        console.error("❌ generateGoldLayer MISSING");
    }
}

verifyRefactor();
