import app from './app';
import { initOverdueScanner } from './cron/overdueScan';

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be defined in the environment.');
}

const PORT = process.env.PORT || 3000;

initOverdueScanner();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
