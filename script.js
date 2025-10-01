// ====================
// COUNTER ANIMATION
// ====================
const counters = document.querySelectorAll('.counter');
let counterStarted = false;

function animateCounters() {
  if (!counterStarted) {
    counters.forEach(counter => {
      const updateCount = () => {
        const target = +counter.getAttribute('data-target');
        const count = +counter.innerText;
        const increment = target / 200;

        if (count < target) {
          counter.innerText = Math.ceil(count + increment);
          setTimeout(updateCount, 20);
        } else {
          counter.innerText = target;
        }
      };
      updateCount();
    });
    counterStarted = true;
  }
}

const impactSection = document.querySelector('#impact');
if (impactSection) {
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) animateCounters();
  }, { threshold: 0.5 });

  observer.observe(impactSection);
}

// ====================
// UNIVERSAL USER MODAL
// ====================
const userModal = document.getElementById("userModal");
const userModalMessage = document.getElementById("userModalMessage");
const closeUserModal = document.getElementById("closeUserModal");

function showUserModal(message, isError = false) {
  if (!userModal || !userModalMessage) return;
  userModalMessage.textContent = message;
  userModal.classList.toggle("error", isError);
  userModal.style.display = "block";
}

if (closeUserModal) {
  closeUserModal.addEventListener("click", () => {
    userModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === userModal) userModal.style.display = "none";
});

// ====================
// DONATION LOGIC
// ====================
document.addEventListener("DOMContentLoaded", () => {
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const donorsList = document.getElementById("donors-list");
  const donateForm = document.getElementById("donate-form");
  const emailInput = document.getElementById("email");
  const amountInput = document.getElementById("amount");

  // Thank You Modal elements
  const thankYouModal = document.getElementById("thankYouModal");
  const closeModal = document.getElementById("closeModal");
  const thankYouMessage = document.getElementById("thankYouMessage");

  const goal = 100000; // ₦1000 in kobo

  // ---- LOAD PROGRESS ----
  function loadProgress() {
    if (!progressBar || !progressText) return;
    fetch("http://localhost:5000/get-progress")
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          const raised = parseInt(data.raised, 10) || 0;
          const percent = Math.min((raised / goal) * 100, 100);
          progressBar.style.width = percent + "%";
          progressText.textContent = `₦${(raised / 100).toFixed(2)} raised of ₦${(goal / 100).toFixed(2)}`;
        }
      })
      .catch(() => showUserModal("Error loading donation progress", true));
  }

  // ---- LOAD DONORS ----
  function loadDonors() {
    if (!donorsList) return;
    fetch("http://localhost:5000/get-donors")
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          donorsList.innerHTML = "";
          if (data.donors.length === 0) {
            const li = document.createElement("li");
            li.textContent = "Be the first to donate 💖";
            donorsList.appendChild(li);
          } else {
            const recentDonors = data.donors.slice(0, 5);
            recentDonors.forEach(donor => {
              const li = document.createElement("li");

              // Mask email
              const [name, domain] = donor.email.split("@");
              const maskedName = name.length > 2 ? name.slice(0, 2) + "***" : name[0] + "***";
              const maskedEmail = `${maskedName}@${domain}`;

              li.textContent = `${maskedEmail} donated ₦${(donor.amount / 100).toFixed(2)}`;
              donorsList.appendChild(li);
            });
          }
        }
      })
      .catch(() => showUserModal("Error loading donors list", true));
  }

  // ---- PAYSTACK ----
  function payWithPaystack(email, amount) {
    let handler = PaystackPop.setup({
      key: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxx', // replace with your Paystack public key
      email: email,
      amount: amount,
      currency: "NGN",
      callback: function (response) {
        verifyPayment(response.reference, amount, email);
      },
      onClose: function () {
        showUserModal("Payment window closed", true);
      }
    });
    handler.openIframe();
  }

  // ---- SHOW THANK YOU MODAL ----
function showThankYouModal(message) {
  if (!thankYouModal || !thankYouMessage) return;

  thankYouMessage.textContent = message;
  thankYouModal.classList.add("show");
  thankYouModal.classList.remove("hide");

  // Auto close with fade-out
  setTimeout(() => {
    thankYouModal.classList.add("hide");
    setTimeout(() => {
      thankYouModal.classList.remove("show");
    }, 500); // match CSS transition (0.5s)
  }, 5000);
}

// ---- VERIFY PAYMENT ----
function verifyPayment(reference, amount, donorEmail) {
  fetch("http://localhost:5000/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, amount })
  })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        const [name, domain] = donorEmail.split("@");
        const maskedName = name.length > 2 ? name.slice(0, 2) + "***" : name[0] + "***";
        const maskedEmail = `${maskedName}@${domain}`;

        showThankYouModal(
          `Thank you ${maskedEmail} for donating ₦${(amount / 100).toFixed(2)} 💖`
        );

        loadProgress();
        loadDonors();
      } else {
        showUserModal("Payment verification failed. Please contact support.", true);
      }
    })
    .catch(() => showUserModal("Error verifying payment", true));
}

// ---- MANUAL CLOSE ----
if (closeModal) {
  closeModal.addEventListener("click", () => {
    thankYouModal.classList.add("hide");
    setTimeout(() => {
      thankYouModal.classList.remove("show");
    }, 500);
  });
}
window.addEventListener("click", (e) => {
  if (e.target === thankYouModal) {
    thankYouModal.classList.add("hide");
    setTimeout(() => {
      thankYouModal.classList.remove("show");
    }, 500);
  }
});

  // ---- FORM HANDLER ----
  if (donateForm) {
    donateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const amount = parseFloat(amountInput.value) * 100; // convert to kobo

      if (!email || amount <= 0) {
        showUserModal("Please enter a valid email and donation amount", true);
        return;
      }

      payWithPaystack(email, amount);
    });
  }

  // ---- INIT ----
  loadProgress();
  loadDonors();
  setInterval(() => {
    loadProgress();
    loadDonors();
  }, 10000);
});


// ====================
// CONTACT FORM
// ====================
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = contactForm.querySelector('[name="name"]').value.trim();
    const email = contactForm.querySelector('[name="email"]').value.trim();
    const message = contactForm.querySelector('[name="message"]').value.trim();

    if (!name || !email || !message) {
      showUserModal("Please fill out all fields", true);
      return;
    }

    showUserModal(`Thank you ${name}, your message has been sent!`);
    contactForm.reset();
  });
}

// ====================
// NETLIFY FORMS (Volunteer, Contact, Register)
// ====================
function handleNetlifyForm(formId, successMsg) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    fetch("/", {
      method: "POST",
      body: formData
    })
      .then(() => {
        showUserModal(successMsg);
        form.reset();
      })
      .catch(() => {
        showUserModal("Something went wrong. Please try again later.", true);
      });
  });
}

// Attach handlers
handleNetlifyForm("volunteerForm", "Thank you, your volunteer application has been received!");
handleNetlifyForm("contactForm", "Thank you, your message has been sent!");
handleNetlifyForm("registerForm", "Thank you for registering, we will be in touch!");



const heroButtons = document.querySelectorAll('.hero-btn');
heroButtons.forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const action = btn.getAttribute('data-action');
    switch(action) {
      case 'donate':
        showUserModal('Donation window will open soon!');
        break;
      case 'volunteer':
        showUserModal('Volunteer request received!');
        break;
      case 'register':
        showUserModal('Registration request received!');
        break;
    }
  });
});


// NAVIGATION + MOBILE MENU
// ====================
const navLinks = document.querySelectorAll('.nav-links a');
const currentPage = window.location.pathname.split('/').pop();

navLinks.forEach(link => {
  if (link.getAttribute('href') === currentPage) {
    link.classList.add('active');
  }
});

const hamburger = document.getElementById('hamburger');
const navLinksMenu = document.getElementById('navLinks');
const navCta = document.querySelector('.nav-cta');

if (hamburger && navLinksMenu && navCta) {
  hamburger.addEventListener('click', () => {
    navLinksMenu.classList.toggle('show');
    navCta.classList.toggle('show');
    hamburger.classList.toggle('active');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinksMenu.classList.remove('show');
      navCta.classList.remove('show');
      hamburger.classList.remove('active');
    });
  });
}


// ====================
// DROPDOWN TOGGLE (MOBILE)
// ====================
const dropdowns = document.querySelectorAll('.dropdown');
if (dropdowns.length) {
  dropdowns.forEach(drop => {
    drop.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        drop.classList.toggle('show');
      }
    });
  });
}

// ====================
// CONFETTI EFFECT
// ====================
const confetti = document.getElementById('confetti');
if (confetti) {
  for (let i = 0; i < 40; i++) {
    const span = document.createElement('span');
    span.style.left = Math.random() * 100 + "vw";
    span.style.background = ["#f76b1c", "#ffcc00", "#0077cc"][Math.floor(Math.random() * 3)];
    span.style.animationDuration = (Math.random() * 3 + 2) + "s";
    span.style.opacity = Math.random();
    confetti.appendChild(span);
  }
}

// ====================
// DARK MODE
// ====================
(function() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggle");
  const body = document.body;

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    body.classList.toggle("dark-mode", savedTheme === "dark");
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    body.classList.add("dark-mode");
    localStorage.setItem("theme", "dark");
  }

  if (toggleBtn) {
    toggleBtn.textContent = body.classList.contains("dark-mode") ? "☀" : "🌙";
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("dark-mode");
      localStorage.setItem("theme", body.classList.contains("dark-mode") ? "dark" : "light");
      toggleBtn.textContent = body.classList.contains("dark-mode") ? "☀" : "🌙";
    });
  }
});



// ====================
// TIMELINE REVEAL
// ====================
const timelineItems = document.querySelectorAll(".timeline-item");
const revealOnScroll = () => {
  const triggerBottom = window.innerHeight * 0.85;
  timelineItems.forEach(item => {
    const boxTop = item.getBoundingClientRect().top;
    if (boxTop < triggerBottom) item.classList.add("show");
  });
};
window.addEventListener("scroll", revealOnScroll);
revealOnScroll();

// ====================
// FOUNDER READ MORE
// ====================
const readMoreBtn = document.getElementById("readMoreBtn");
const moreText = document.getElementById("moreText");

if (readMoreBtn && moreText) {
  readMoreBtn.addEventListener("click", () => {
    if (moreText.style.display === "block") {
      moreText.style.display = "none";
      readMoreBtn.textContent = "Read More";
    } else {
      moreText.style.display = "block";
      readMoreBtn.textContent = "Read Less";
    }
  });
}

// ====================
// DYNAMIC IMAGE CHANGER
// ====================
const images = ["nwanyi01.jpg", "edited2.jpg", "edited3.jpg", "edited09.jpg"];
const imageElement = document.getElementById("dynamicImage");

function changeImage() {
  if (!imageElement) return;
  imageElement.style.opacity = 0;

  setTimeout(() => {
    let randomIndex;
    let currentImage = imageElement.src ? imageElement.src.split("/").pop() : "";
    do {
      randomIndex = Math.floor(Math.random() * images.length);
    } while (images[randomIndex] === currentImage);

    imageElement.src = images[randomIndex];
    imageElement.style.opacity = 1;
  }, 1000);
}
if (imageElement) setInterval(changeImage, 5000);

// ====================
// MODAL FUNCTIONALITY
// ====================
const modal = document.getElementById("eventModal");
const closeBtn = document.querySelector(".close-btn");
const registerBtns = document.querySelectorAll(".register-btn");
const eventNameInput = document.getElementById("eventName");
const modalTitle = document.getElementById("modalTitle");

if (modal && closeBtn && registerBtns.length) {
  registerBtns.forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const eventName = btn.getAttribute("data-event");
      modalTitle.textContent = "Register for " + eventName;
      eventNameInput.value = eventName;
      modal.style.display = "block";
    });
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });

  const eventForm = document.getElementById("eventForm");
  if (eventForm) {
    eventForm.addEventListener("submit", e => {
      e.preventDefault();
      alert("Thank you for registering! We will contact you soon.");
      modal.style.display = "none";
    });
  }
} 

