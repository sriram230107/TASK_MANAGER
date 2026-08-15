import app from './app';
import { initOverdueScanner } from './cron/overdueScan';

const PORT = process.env.PORT || 3000;

initOverdueScanner();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
