const fetchUrl = require("fetch").fetchUrl;
const _ = require("lodash");
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey('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');

const readFriends = (file) => {
  return new Promise((resolve, reject) => {
    const Converter = require("csvtojson").Converter;
    const converter = new Converter({});

    converter.on("end_parsed", function (jsonArray) {
      jsonArray.forEach(item => item.negados = JSON.parse(item.negados));
      resolve(jsonArray);
    });

    require("fs").createReadStream(file).pipe(converter);
  });
};

const generateRandomNumbersFallback = (max, quantity) => {
  const result = [];
  max = max + 1;
  for (let x = 0; x < quantity; x++) {
    result.push(Math.floor(Math.random() * max));
  }
  return Promise.resolve().then(() => result);
};

const generateRandomNumbers = (max, quantity) => {
  quantity = quantity || 1000;
  const url = `https://www.random.org/integers/?num=${quantity}&min=0&max=${max}&col=1&base=10&format=plain&rnd=new`;
  return new Promise((resolve, reject) => {
    fetchUrl(url, function(error, meta, body){
      if (error) {
        reject(error);
        return;
      }
      resolve(body.toString());
    });
  }).then((numbers) => {
    return numbers.split('\n').filter(n => {
      return n.match(/^\d+$/);
    }).map(n => n * 1);
  }).then(numbers => {

    if (numbers.length < quantity) {
      throw "Invalid number list";
    }
    return numbers;
  }).catch(() => {
    return generateRandomNumbersFallback(max, quantity);
  });
}

const generateMoves = (numbers) => {
  return Promise.resolve().then(() => {
    return _.chunk(numbers, 2);
  });
}

const movePeople = (friendList, chunks) => {
  const friends = JSON.parse(JSON.stringify(friendList));

  return new Promise((resolve, reject) => {
    chunks.forEach(couple => {

      const fa = couple[0];
      const fb = couple[1];

      if (fa == undefined || fb == undefined) {
        return;
      }

      const aux = friends[fa];

      friends[fa] = friends[fb];
      friends[fb] = aux;
    });

    resolve(friends);
  });
};

const generateFriendList = (friends) => {
  const max = friends.length;
  friends.push(JSON.parse(JSON.stringify(friends[0])));

  return new Promise((resolve, reject) => {
    const result = [];

    for (let x = 0; x < max; x++) {
      result.push({
        from: friends[x],
        to: friends[x+1]
      });
    }

    resolve(result);
  });
};

const validateList = (result => {

  let valid = true;

  result.forEach(couple => {
    if (couple.from.negados.indexOf(Number(couple.to.id)) >= 0) {
      console.log(`${couple.from.nome} tirou ${couple.to.nome}`);
      valid = false;
    }
  });

  if (!valid) {
    return Promise.reject();
  }

  return Promise.resolve(result);
});

const sorteio = (friends) => {
  const max = friends.length - 1;
  console.log("SORTEANDO");
  return generateRandomNumbers(max, 5000)
    .then(generateMoves)
    .then(chunks => {
      return movePeople(friends, chunks);
    })
    .then(generateFriendList)
    .then(validateList)
    .catch((err) => {
      return sorteio(friends);
    });
}

const sendEmail = (to, subject, text) => {

  const msg = {
    from: 'Amigo Secreto <amigosecreto@gmail.com>',
    to,
    subject,
    text,
  };

  return sgMail.send(msg);
}

const notifyMaster = (result) => {
  console.log('Notificando: Mestre');
  const summary = result.map(i => {
    return i.from.nome + '->' + i.to.nome;
  }).join('\n');

  return sendEmail('evauviedo@gmail.com', 'TOP SECRET! -> Amigo Secreto 2019', summary)
    .then(() => result);
}

const reportFriend = (list, resolve) => {
  if (list.length === 0) {
    return resolve();
  }
  const target = list.splice(0, 1)[0];
  return new Promise((resolve, reject) => {
    console.log('notificando: ' + target.from.nome);
    target.to.sugestao = target.to.sugestao || '-'
    sendEmail(target.from.email, 'Confidencial: Seu Amigo Secreto 2019', `Olá ${target.from.nome}, seu amigo secreto é:\n\n\n${target.to.nome}\n\n\nE ele(a) gostaria de:\n\n${target.to.sugestao}`)
      .then(() => reportFriend(list, resolve))
      .catch((err) => {
        list.push(target);
        return reportFriend(list, resolve);
      });
  });
}


const reportAll = (result, promise) => {
  return new Promise((resolve, reject) => {
    reportFriend(result, resolve);
  });
};

readFriends("./amigos.csv")
  .then(sorteio)
  .then(notifyMaster)
  .then(reportAll)
  .then(() => {
    console.log("Todo mundo notificado!, boas festas!");
  })
  .catch(err => console.log(err));
