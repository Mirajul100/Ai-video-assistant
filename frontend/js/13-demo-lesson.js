// LUMEN — AI Lesson Assistant
// Section 13: DEMO LESSON

  /* -----------------------------------------------------------------
     13. DEMO LESSON
  ----------------------------------------------------------------- */
  function loadDemoLesson() {
    const demo = {
      title: "Introduction to Neural Networks",
      transcript:
        "Welcome back, everyone. Today we're starting a new unit on neural networks, which are one of the core ideas behind modern AI.\n" +
        "A neural network is a system of connected nodes, called neurons, organized in layers: an input layer, one or more hidden layers, and an output layer.\n" +
        "Each connection between neurons has a weight, and each neuron applies an activation function to decide how strongly it should fire.\n" +
        "Activation functions like ReLU and sigmoid introduce non-linearity, which is what allows a network to learn complex patterns instead of just straight lines.\n" +
        "Training a network means adjusting those weights so the network's predictions get closer to the correct answers over time.\n" +
        "This adjustment happens through a process called backpropagation, combined with an optimization method like gradient descent.\n" +
        "The key takeaway for today is that a neural network is really just a flexible function that learns its own parameters from examples.\n" +
        "Next class, we'll look at a simple network trained to recognize handwritten digits, so bring your laptops.",
      summary:
        "This lesson introduces neural networks as layered systems of connected neurons that transform an input into an output. It covers how weighted connections and activation functions like ReLU and sigmoid let a network model non-linear patterns, and explains that training adjusts those weights using backpropagation and gradient descent so predictions improve over time. The lesson frames a neural network as a flexible function that learns its own parameters from examples, setting up next class's hands-on digit-recognition exercise.",
      key_points: [
        { title: "Layered structure", description: "A neural network is organized into an input layer, hidden layers, and an output layer of connected neurons." },
        { title: "Weights and connections", description: "Every connection between neurons carries a weight that scales how much influence one neuron has on the next." },
        { title: "Activation functions", description: "Functions like ReLU and sigmoid add non-linearity, letting the network learn more than straight-line relationships." },
        { title: "Backpropagation and gradient descent", description: "Training adjusts weights by propagating errors backward and nudging them with gradient descent." },
      ],
      questions: [
        "What is a neural network, in simple terms?",
        "Why do activation functions need to be non-linear?",
        "How does backpropagation adjust a network's weights?",
        "What role does gradient descent play in training?",
      ],
    };

    const demoUrl = null; // no real source video -- keep the demo honest
    state.isDemo = true;
    applyLessonData({ ...demo, session_id: null }, demoUrl);
    updateSidebarChip("ready", demo.title + " (demo)");
    pushNotification(`"${demo.title}" sample lesson loaded.`);
    showToast("Sample lesson loaded — this is demo data, not a real video.", "info");
    setActiveView("dashboard");
  }

  function initDemo() {
    $("#heroDemoBtn").addEventListener("click", loadDemoLesson);
  }

  // Guards the "Watch on YouTube" link on the dashboard overview card so it
  // never navigates to "#" for the demo lesson, which has no real source.
  function initOverviewSourceLink() {
    $("#overviewSourceLink").addEventListener("click", (e) => {
      if (!state.lesson || !state.lesson.sourceUrl) {
        e.preventDefault();
        showToast("This is a sample lesson — there's no real source video.", "info");
      }
    });
  }
