const CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomId() {
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += CHARACTERS.charAt(
            Math.floor(Math.random() * CHARACTERS.length)
        );
    }
    return result.slice(0, 3) + '-' + result.slice(3);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { generateRoomId, formatFileSize };