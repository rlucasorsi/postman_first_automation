function checkAuthentication(callback) {
    const authToken = pm.environment.get("authToken");
  
    pm.sendRequest({
      url: pm.request.url.toString().replace("{{baseUrl}}", pm.environment.get("baseUrl")),
      method: pm.request.method,
      header: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json'
      }
    }, function (err, res) {
      if (err || res.code === 401) {
        // Se houver um erro ou a autenticação falhar (401), autentica novamente
        console.log("Erro de autenticação detectado. Iniciando reautenticação...");
        authenticateUser(callback);
      } else {
        // Se a autenticação for bem-sucedida, continua com a operação
        console.log("Autenticação bem-sucedida. Continuando com a solicitação original.");
        callback();
      }
    });
  }
  
  function authenticateUser(callback) {
    pm.sendRequest({
      url: pm.variables.get("urlLogin"),
      method: "POST",
      header: {
        'Accept': "application/json",
        "Content-Type": "application/json",
        'X-URL': pm.variables.get("X-URL")
      },
      body: {
        mode: 'raw',
        raw: JSON.stringify({
          email: pm.variables.get("email"),
          password: pm.variables.get("password"),
        }),
      },
    }, function (err, res) {
      if (err) {
        console.log("Erro durante a autenticação:", err);
      } else {
        const response = res.json();
        const userId = response.user.id;
        pm.environment.set("userId", userId);
  
        // Chama a segunda etapa de autenticação (2FA)
        perform2FA(userId, callback);
      }
    });
  }
  
  function perform2FA(userId, callback) {
    pm.sendRequest({
      url: pm.variables.get("urlTwoFa"),
      method: "POST",
      header: {
        'Accept': "application/json",
        "Content-Type": "application/json",
        'X-URL': pm.variables.get("X-URL")
      },
      body: {
        mode: 'raw',
        raw: JSON.stringify({
          idUser: userId,
          token: pm.variables.get("token2FA"),
        }),
      },
    }, function (err, res) {
      if (err) {
        console.log("Erro durante a 2FA:", err);
      } else {
        const response = res.json();
        console.log(response.status);
        if (response.status === 401 && response.message === "Invalid token. The user is not authenticated") {
          console.log("Token 2FA inválido. A autenticação falhou.");
         postman.setNextRequest(null);
        } else {
          const authToken = response.user.accessToken;
          pm.environment.set("authToken", authToken);
          console.log("Token de autenticação 2FA obtido com sucesso:", authToken);
          callback();
        }
      }
    });
  }
  
  // Callback que define o que fazer após a verificação ou reautenticação
  const callback = function() {
    console.log("Enviando solicitação original...");
    pm.sendRequest({
      url: pm.request.url.toString().replace("{{baseUrl}}", pm.environment.get("baseUrl")),
      method: pm.request.method,
      header: {
        'Authorization': `Bearer ${pm.environment.get("authToken")}`,
        'Accept': 'application/json'
      }
    }, function (err, res) {
      if (err) {
        console.log("Erro durante a solicitação original:", err);
      } else {
        console.log("Solicitação original re-executada com sucesso.");
      }
    });
  };
  
  // Executa a verificação de autenticação antes de cada solicitação
  checkAuthentication(callback);
  