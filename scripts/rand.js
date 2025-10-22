import crypto from 'crypto';

crypto.randomBytes(32, (err, data) => {
    if (err) {
        throw err;
    }
    console.log(data.toString('base64url'));
})
