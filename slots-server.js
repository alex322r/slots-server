const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

const INITIAL_CREDITS = 1000;

// Símbolos del slot: 0=Cherry, 1=Lemon, 2=Bell, 3=Star, 4=Seven
const SYMBOLS = ['cherry', 'lemon', 'bell', 'star', 'seven'];
const SYMBOL_WEIGHTS = [30, 25, 20, 15, 10]; // Seven es el más raro

// Estado de los jugadores
let players = {};

// Generar un símbolo aleatorio con pesos
function getRandomSymbol() {
  const totalWeight = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < SYMBOLS.length; i++) {
    random -= SYMBOL_WEIGHTS[i];
    if (random <= 0) {
      return i;
    }
  }
  return 0;
}

// Generar resultado de 3 carretes
function spinReels() {
  return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
}

// Calcular ganancias
function calculateWinnings(reels, betAmount) {
  const [r1, r2, r3] = reels;
  
  // Tres 7s = Jackpot (20x)
  if (r1 === 4 && r2 === 4 && r3 === 4) {
    return { multiplier: 20, winType: 'JACKPOT' };
  }
  
  // Tres iguales = 10x
  if (r1 === r2 && r2 === r3) {
    return { multiplier: 10, winType: 'THREE_OF_A_KIND' };
  }
  
  // Dos iguales = 2x
  if (r1 === r2 || r2 === r3 || r1 === r3) {
    return { multiplier: 2, winType: 'TWO_OF_A_KIND' };
  }
  
  // Sin premio
  return { multiplier: 0, winType: 'LOSE' };
}

// Conexiones de socket
io.on('connection', (socket) => {
  console.log('Jugador conectado a Slots:', socket.id);

  // Inicializar jugador
  players[socket.id] = {
    credits: INITIAL_CREDITS,
    isSpinning: false
  };

  // Enviar estado inicial
  socket.emit('initialState', {
    credits: players[socket.id].credits,
    symbols: SYMBOLS
  });

  // Evento de girar
  socket.on('spin', (data) => {
    const player = players[socket.id];
    
    if (!player) return;
    if (player.isSpinning) return;
    if (data.bet <= 0) return;
    if (data.bet > player.credits) {
      socket.emit('error', { message: 'Créditos insuficientes' });
      return;
    }

    // Marcar como girando y descontar apuesta
    player.isSpinning = true;
    player.credits -= data.bet;

    socket.emit('spinStarted', { 
      newBalance: player.credits,
      bet: data.bet 
    });

    // Simular tiempo de giro (2.5 segundos)
    setTimeout(() => {
      const reels = spinReels();
      const result = calculateWinnings(reels, data.bet);
      const winnings = data.bet * result.multiplier;
      
      player.credits += winnings;
      player.isSpinning = false;

      socket.emit('spinResult', {
        reels,
        symbols: reels.map(r => SYMBOLS[r]),
        winType: result.winType,
        multiplier: result.multiplier,
        winnings,
        newBalance: player.credits
      });

    }, 2500);
  });

  socket.on('disconnect', () => {
    console.log('Jugador desconectado de Slots:', socket.id);
    delete players[socket.id];
  });
});

server.listen(8082, '0.0.0.0', () => {
  console.log('🎰 Servidor Slots corriendo en puerto 8082');
});
