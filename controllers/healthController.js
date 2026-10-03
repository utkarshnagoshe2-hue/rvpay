const getHealth = (request, response) => {
  response.json({ status: 'ok' });
};

module.exports = { getHealth };
