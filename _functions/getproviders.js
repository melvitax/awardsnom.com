const axios = require("axios")

export function handler(event, context, callback) {
  // apply our function to the queryStringParameters and assign it to a variable
  //const API_PARAMS = qs.stringify(event.queryStringParameters)
  const MEDIA_TYPE = event['queryStringParameters']['media_type']
  const MEDIA_ID = event['queryStringParameters']['id']
  // Get env var values defined in our Netlify site UI
  const { API_TOKEN, API_URL } = process.env
  // In this example, the API Key needs to be passed in the params with a key of key.
  // We're assuming that the ApiParams var will contain the initial ?
  const URL = `${API_URL}/${MEDIA_TYPE}/${MEDIA_ID}/watch/providers?api_key=${API_TOKEN}`
  // Let's log some stuff we already have.
  console.log("Injecting token to", API_URL);
  console.log("logging event.....", event)
  console.log("Constructed URL is ...", URL)

   // Here's a function we'll use to define how our response will look like when we call callback
  const pass = (body) => {callback( null, {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": "*"}, 
    body: JSON.stringify(body)
  })}

  // Perform the API call.
  const get = () => {
    axios.get(URL)
    .then((response) =>
      {
        console.log(response.data)
        pass(response.data)
      }
    )
    .catch(err => pass(err))
  }
  if(event.httpMethod == 'GET'){
    get()
  };
};
