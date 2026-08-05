// Password toggle utility - adds eye icons to password fields using Bootstrap Icons
(function() {
  'use strict';
  
  function initPasswordToggles() {
    // Find all password input fields
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(field => {
      // Skip if already has toggle (avoid duplicates)
      if (field.parentElement.classList.contains('password-wrapper')) {
        return;
      }
      
      // Create wrapper div
      const wrapper = document.createElement('div');
      wrapper.className = 'password-wrapper';
      
      // Move the original input inside wrapper
      field.parentNode.insertBefore(wrapper, field);
      wrapper.appendChild(field);
      
      // Create toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'password-toggle';
      toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
      toggleBtn.setAttribute('aria-label', 'Mostrar/ocultar senha');
      toggleBtn.setAttribute('title', 'Mostrar senha');
      
      // Add click handler
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Toggle password visibility
        const isPassword = field.type === 'password';
        field.type = isPassword ? 'text' : 'password';
        
        // Toggle eye icon
        const icon = toggleBtn.querySelector('i');
        if (isPassword) {
          icon.className = 'bi bi-eye-slash';
          toggleBtn.title = 'Ocultar senha';
        } else {
          icon.className = 'bi bi-eye';
          toggleBtn.title = 'Mostrar senha';
        }
      });
      
      // Add hover effect for better UX
      toggleBtn.addEventListener('mouseenter', function() {
        toggleBtn.style.opacity = '0.8';
      });
      
      toggleBtn.addEventListener('mouseleave', function() {
        toggleBtn.style.opacity = '1';
      });
      
      // Add button to wrapper
      wrapper.appendChild(toggleBtn);
      
      // Add CSS for the toggle button
      addToggleStyles();
    });
  }
  
  function addToggleStyles() {
    if (document.getElementById('password-toggle-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'password-toggle-styles';
    style.textContent = `
    .password-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
    }
    .password-wrapper input[type="password"],
    .password-wrapper input[type="text"] {
      padding-right: 40px;
      box-sizing: border-box;
    }
    .password-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }
    .password-toggle:hover {
      background: rgba(148, 163, 184, 0.1);
      color: #cbd5e1;
    }
    .password-toggle i {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Ensure button is visible on mobile */
    @media (max-width: 768px) {
      .password-toggle {
        width: 36px;
        height: 36px;
        right: 4px;
      }
      .password-wrapper input[type="password"],
      .password-wrapper input[type="text"] {
        padding-right: 44px;
      }
    }
    `;
    
    document.head.appendChild(style);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordToggles);
  } else {
    initPasswordToggles();
  }
})();