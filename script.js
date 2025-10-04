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
  const baseURL = "https://nwanyiogwuanwu-widows.onrender.com";

  // ---- LOAD PROGRESS ----
  function loadProgress() {
    if (!progressBar || !progressText) return;
    fetch(`${baseURL}/get-progress`)
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
    fetch(`${baseURL}/get-donors`)
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
      key: 'pk_live_21f95e6aa3c7c285a0e9db68656bb9294bb81f51', 
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

    setTimeout(() => {
      thankYouModal.classList.add("hide");
      setTimeout(() => {
        thankYouModal.classList.remove("show");
      }, 500);
    }, 5000);
  }

  // ---- VERIFY PAYMENT ----
  function verifyPayment(reference, amount, donorEmail) {
    fetch(`${baseURL}/verify-payment`, {
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
      const amount = parseFloat(amountInput.value) * 100;

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
// =============================================

function handleNetlifyForm(formId, successMsg) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Create FormData from the form
    const formData = new FormData(form);

    // Ensure the form-name field is present (Netlify requires it)
    const formName = form.getAttribute("name") || form.id;
    formData.set("form-name", formName);

    // Optional: log fields for debugging
    for (const pair of formData.entries()) {
      console.log(`${pair[0]}: ${pair[1]}`);
    }

    // Submit the form data to Netlify
    fetch("/", {
      method: "POST",
      body: formData
      // No need to set headers, the browser will handle multipart/form-data automatically
    })
      .then((resp) => {
        console.log("Netlify response:", resp.status);
        showUserModal(successMsg); // Use your existing modal
        form.reset();
      })
      .catch((err) => {
        console.error("Submission error:", err);
        showUserModal("Something went wrong. Please try again later.", true);
      });
  });
}

// Initialize all Netlify forms
handleNetlifyForm(
  "volunteerForm",
  "Thank you, your volunteer application has been received!"
);
handleNetlifyForm(
  "contactForm",
  "Thank you, your message has been sent!"
);
handleNetlifyForm(
  "registerForm",
  "Thank you for registering, we will be in touch!"
);

// ====================
// HERO BUTTONS
// ====================
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

// ====================
// NAVIGATION + MOBILE MENU
// ====================
const navLinks = document.querySelectorAll('.nav-links a');
const currentPage = window.location.pathname.split('/').pop();

navLinks.forEach(link => {
  if (link.getAttribute('href') === currentPage) {
    link.classList.add('active');
  }
});

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
// DARK MODE + HAMBURGER
// ====================
(function () {
  const btn = document.getElementById('toggle');
  const body = document.body;
  const hamburger = document.getElementById('hamburger');
  const navLinksMenu = document.getElementById('navLinks');
  const navCta = document.querySelector('.nav-cta');

  (function initDarkMode() {
    if (btn && !btn.classList.contains('dark-toggle')) btn.classList.add('dark-toggle');

    const stored = localStorage.getItem('theme');
    if (stored === 'dark') body.classList.add('dark-mode');
    else if (stored === 'light') body.classList.remove('dark-mode');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    }

    if (btn) {
      btn.textContent = body.classList.contains('dark-mode') ? '☀' : '🌙';
      btn.setAttribute('aria-pressed', String(body.classList.contains('dark-mode')));
      btn.addEventListener('click', () => {
        const nowDark = body.classList.toggle('dark-mode');
        localStorage.setItem('theme', nowDark ? 'dark' : 'light');
        btn.textContent = nowDark ? '☀' : '🌙';
        btn.setAttribute('aria-pressed', String(nowDark));
      });
    }
  })();

  if (hamburger) {
    function setOpenState(open) {
      hamburger.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      hamburger.setAttribute('aria-expanded', String(!!open));
      if (navLinksMenu) navLinksMenu.classList.toggle('show', open);
      if (navCta) navCta.classList.toggle('show', open);
    }

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpenState(!hamburger.classList.contains('open'));
    });

    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpenState(!hamburger.classList.contains('open'));
      }
    });

    if (navLinksMenu) {
      navLinksMenu.addEventListener('click', (e) => {
        const el = e.target;
        if (el && el.tagName === 'A') setOpenState(false);
      });
    }

    document.addEventListener('click', (e) => {
      const clickedInHamburger = !!e.target.closest('#hamburger');
      const clickedInNav = !!e.target.closest('#navLinks') || !!e.target.closest('.nav-cta');
      if (!clickedInHamburger && !clickedInNav && document.body.classList.contains('nav-open')) setOpenState(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setOpenState(false);
    });
  }

  if (!hamburger) console.warn('Hamburger not found: element #hamburger missing.');
  if (!navLinksMenu) console.warn('Nav links container not found: element #navLinks missing.');
})();

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
const images = ["nwanyi01.jpg", "foundation5.jpg", "edited30.jpg", "edited09.jpg"];
const imageElement = document.getElementById("dynamicImage");
let currentIndex = 0;

function changeImage() {
  if (!imageElement) return;
  imageElement.style.opacity = 0;
  imageElement.addEventListener("transitionend", function handler() {
    currentIndex = (currentIndex + 1) % images.length;
    imageElement.src = images[currentIndex];
    imageElement.style.opacity = 1;
    imageElement.removeEventListener("transitionend", handler);
  });
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

  closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
  window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

  const eventForm = document.getElementById("eventForm");
  if (eventForm) {
    eventForm.addEventListener("submit", e => {
      e.preventDefault();
      alert("Thank you for registering! We will contact you soon.");
      modal.style.display = "none";
    });
  }
}
