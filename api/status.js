const { WIKIPEDIA_TEXT } = require('./knowledge');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    environment: 'vercel-serverless',
    knowledgeLength: WIKIPEDIA_TEXT.length,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
};
