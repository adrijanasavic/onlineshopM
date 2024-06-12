const MONGO_PASS = 'master1';
const MONGODB_URL = `mongodb+srv://mihaljtandi:${MONGO_PASS}@cluster0.gqan2al.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

`;
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
};

module.exports = {
    MONGO_PASS: MONGO_PASS,
    MONGODB_URL: MONGODB_URL,
    mongooseOptions: mongooseOptions
};