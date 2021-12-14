require("dotenv").config(); //this loads the .env file.  the contents of the .env file will initialize values for environmental variables that have not already been set (e.g. the secret key)
// console.log("environmental variables: ", process.env.SECRET_KEY);
const bcrypt = require("bcrypt");

const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const config = {
  logging: false,
};
const jwt = require("jsonwebtoken");

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

User.byToken = async (token) => {
  try {
    const verifiedToken = jwt.verify(token, process.env.SECRET_KEY);

    if (verifiedToken) {
      const user = await User.findByPk(verifiedToken.id);
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  const correct = await bcrypt.compare(password, user.password);
  if (correct) {
    const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY);
    return token;
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

User.beforeCreate(async (user) => {
  if (user.changed("password")) {
    //this needs to be awaited because we are putting the hashed password in the database.
    //the second argument is salt rounds.  That's the number of times the hash is running.  every time you hash a password it gets longer because it is transformed.
    user.password = await bcrypt.hash(user.password, 3);
  }
});

module.exports = {
  syncAndSeed,
  models: {
    User,
  },
};
