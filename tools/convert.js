const { mdToPdf } = require('md-to-pdf');
const path = require('path');

(async () => {
    try {
        const pdf = await mdToPdf(
            { path: path.join(__dirname, '..', 'SPS_System_Documentation.md') }, 
            { 
                dest: path.join(__dirname, '..', 'SPS_System_Documentation.pdf'),
                launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
                pdf_options: { format: 'A4', margin: '20mm' },
                basedir: path.join(__dirname, '..')
            }
        );
        if (pdf) console.log('Successfully generated PDF');
    } catch (err) {
        console.error(err);
    }
})();
