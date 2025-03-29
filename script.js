const roomIdInput = document.getElementById("roomId");
const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const startGameBtn = document.getElementById("startGame");
const quizContainer = document.getElementById("quiz");
const questionText = document.getElementById("questionText");
const answersContainer = document.getElementById("answers");
const timerDisplay = document.getElementById("timer");
const submitAnswerBtn = document.getElementById("submitAnswer");
const resultDisplay = document.getElementById("result");
const instructionsContainer = document.getElementById("instructions");

let peer;
let isHost = false;
let players = [];
let currentPlayerIndex = 0;
let currentQuestionIndex = 0;
let playerAnswers = [];
let timer;
let gameStarted = false;

// Fetch random question from API
async function fetchQuestion() {
    const response = await fetch("https://opentdb.com/api.php?amount=50&type=multiple");
    const data = await response.json();
    const question = data.results[0];
    return {
        question: question.question,
        options: [...question.incorrect_answers, question.correct_answer],
        correctAnswer: question.correct_answer
    };
}

// Start the game
function startGame() {
    gameStarted = true;
    currentQuestionIndex = 0;
    playerAnswers = [];
    quizContainer.style.display = "block";
    resultDisplay.style.display = "none";
    nextQuestion();
}

// Handle next question
async function nextQuestion() {
    if (currentQuestionIndex >= 10 || players.length === 1) {
        endGame();
        return;
    }

    const { question, options, correctAnswer } = await fetchQuestion();
    questionText.innerHTML = question;
    answersContainer.innerHTML = "";

    options.sort(() => Math.random() - 0.5);
    options.forEach((option, index) => {
        answersContainer.innerHTML += `<label><input type="radio" name="answer" value="${option}"> ${option}</label>`;
    });

    submitAnswerBtn.disabled = false;
    startTimer();

    submitAnswerBtn.onclick = () => {
        const selectedAnswer = document.querySelector('input[name="answer"]:checked');
        if (selectedAnswer) {
            playerAnswers[currentPlayerIndex] = selectedAnswer.value;
            checkAnswer(selectedAnswer.value, correctAnswer);
            sendAnswerToPlayers(selectedAnswer.value); // Send answer to players
        }
    };
}

// Timer
function startTimer() {
    let timeLeft = 15;
    timerDisplay.innerText = `Time Left: ${timeLeft}s`;
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `Time Left: ${timeLeft}s`;
        sendTimerUpdate(timeLeft); // Send timer update to players
        if (timeLeft === 0) {
            clearInterval(timer);
            submitAnswerBtn.disabled = true;
            checkAnswer(null, null);
            sendAnswerToPlayers(null); // Send null if no answer is selected
        }
    }, 1000);
}

// Check answers
function checkAnswer(answer, correctAnswer) {
    if (answer === correctAnswer) {
        playerAnswers[currentPlayerIndex] = "correct";
    } else {
        playerAnswers[currentPlayerIndex] = "incorrect";
        eliminatePlayer();
    }

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    if (currentPlayerIndex === 0) {
        currentQuestionIndex++;
        nextQuestion();
    }
}

// Eliminate incorrect players
function eliminatePlayer() {
    players.splice(currentPlayerIndex, 1);
    if (players.length === 1) {
        endGame();
    }
}

// End the game
function endGame() {
    quizContainer.style.display = "none";
    resultDisplay.style.display = "block";
    const winner = players[0];
    resultDisplay.innerHTML = `${winner} is the winner!`;
}

// Create room (Host)
createRoomBtn.addEventListener("click", () => {
    isHost = true;
    createPeer(true);  // Initialize Peer as Host
});

// Join room (Player)
joinRoomBtn.addEventListener("click", () => {
    isHost = false;  // This makes sure the player knows they are not the host
    const signalData = roomIdInput.value;  // Read the signal data (SDP offer) from the input

    if (signalData) {
        try {
            const parsedData = JSON.parse(signalData);  // Parse the signal data (SDP offer)
            console.log("Parsed signal data: ", parsedData);  // Debug log to verify signal data
            
            // Ensure parsedData is a valid object (offer)
            if (parsedData && parsedData.type && parsedData.sdp) {
                createPeer(false, parsedData);  // Player joins the room using the parsed signal data (SDP offer)
            } else {
                console.error("Invalid signal data format received.");
            }
        } catch (error) {
            console.error("Error parsing signal data:", error);  // Handle parsing errors
        }
    } else {
        console.error("No signal data found. Please make sure the host has created the room.");
    }
});

// Create Peer instance
function createPeer(initiator, signalData = null) {
    peer = new SimplePeer({ initiator, trickle: false });

    peer.on("signal", data => {
        console.log("Signal data generated: ", data); // Log signal data
        roomIdInput.value = JSON.stringify(data); // Store the signal data (SDP offer) into the input field
    });

    peer.on("connect", () => {
        console.log("Peer connection established.");
        if (isHost) {
            startGameBtn.style.display = "block"; // Enable start game button if host
        }
    });

    peer.on("data", data => {
        const message = JSON.parse(data);
        console.log("Received message: ", message);

        if (message.type === "question") {
            currentQuestionIndex = message.index;
            nextQuestion();
        } else if (message.type === "answer") {
            // Process player answers
        }
    });

    // If signalData is provided (player joining the room), connect using the provided signal data
    if (signalData) {
        peer.signal(signalData);  // Use the signal data (SDP offer) to connect
    }
}

// Send question to players
function sendQuestionToPlayers(question, options, correctAnswer) {
    const message = {
        type: "question",
        question,
        options,
        correctAnswer
    };
    peer.send(JSON.stringify(message));
}

// Send player answer to players
function sendAnswerToPlayers(answer) {
    const message = {
        type: "answer",
        answer
    };
    peer.send(JSON.stringify(message));
}

// Send timer update to players
function sendTimerUpdate(timeLeft) {
    const message = {
        type: "timer",
        timeLeft
    };
    peer.send(JSON.stringify(message));
}

// Sync timer with other players
function updateTimer(timeLeft) {
    timerDisplay.innerText = `Time Left: ${timeLeft}s`;
}

// Start the game if Host
startGameBtn.addEventListener("click", () => {
    if (isHost) {
        startGame();
    }
});
