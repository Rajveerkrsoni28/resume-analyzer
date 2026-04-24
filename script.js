/**
 * AI Resume Analyzer - Core Logic (Upgraded)
 */

// Initialize pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// DOM Elements
const resumeInput = document.getElementById('resumeInput');
const fileNameDisplay = document.getElementById('file-name-display');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorMessage = document.getElementById('error-message');
const resultCard = document.getElementById('resultCard');
const darkModeToggle = document.getElementById('darkModeToggle');

// Result Card Elements
const topRolesContainer = document.getElementById('topRolesContainer');
const matchedSkillsEl = document.getElementById('matchedSkills');
const missingSkillsEl = document.getElementById('missingSkills');
const highlightedTextEl = document.getElementById('highlightedText');

// Global State
let jobsData = [];
let uploadedFileContent = "";

/**
 * FEATURE 5: Dark Mode UI
 */
if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    darkModeToggle.textContent = '☀️ Light Mode';
}

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('darkMode', 'enabled');
        darkModeToggle.textContent = '☀️ Light Mode';
    } else {
        localStorage.setItem('darkMode', 'disabled');
        darkModeToggle.textContent = '🌙 Dark Mode';
    }
});

/**
 * INIT: Fetch job data on load.
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchJobsData();
});

async function fetchJobsData() {
    try {
        const response = await fetch('jobs.json');
        if (!response.ok) throw new Error("Failed to load jobs.json");
        jobsData = await response.json();
    } catch (error) {
        showError("Could not load job database. Please try again later.");
    }
}

/**
 * FEATURE 1: PDF Resume Upload (Supports .txt and .pdf)
 */
resumeInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    
    if (file) {
        fileNameDisplay.textContent = `Selected: ${file.name}`;
        errorMessage.classList.add('hidden');
        
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Reading File...';

        // Use PDF.js if file is a PDF
        if (file.name.toLowerCase().endsWith('.pdf')) {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                try {
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let text = '';
                    // Extract text from all pages
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const strings = content.items.map(item => item.str);
                        text += strings.join(' ') + '\n';
                    }
                    uploadedFileContent = text;
                    console.log("PDF read successfully.");
                    analyzeBtn.disabled = false;
                    analyzeBtn.textContent = 'Analyze Resume';
                } catch(e) {
                    console.error(e);
                    showError("Failed to parse PDF file.");
                    analyzeBtn.disabled = false;
                    analyzeBtn.textContent = 'Analyze Resume';
                }
            };
            fileReader.readAsArrayBuffer(file);
        } else {
            // Read TXT normally
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedFileContent = e.target.result;
                console.log("TXT read successfully.");
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Analyze Resume';
            };
            reader.readAsText(file);
        }
    } else {
        fileNameDisplay.textContent = "No file chosen";
        uploadedFileContent = "";
    }
});

analyzeBtn.addEventListener('click', () => {
    if (!resumeInput.files.length) {
        showError("Please upload a resume file first.");
        return;
    }
    
    if (!uploadedFileContent || !uploadedFileContent.trim()) {
        showError("The uploaded file appears to be empty!");
        return;
    }

    if (jobsData.length === 0) {
        showError("Job data is not ready yet.");
        return;
    }

    errorMessage.classList.add('hidden');
    
    // Process matches
    const matches = findAllMatches(uploadedFileContent, jobsData);
    
    if (matches && matches.length > 0) {
        displayResults(matches, uploadedFileContent);
    } else {
        showError("Could not match to any roles.");
    }
});

/**
 * FEATURE 4: Multiple Job Role Comparison (Top 3)
 */
function findAllMatches(resumeText, jobs) {
    const textLower = resumeText.toLowerCase();
    let allMatches = [];

    jobs.forEach(job => {
        let matchedCount = 0;
        let currentMatchedSkills = [];
        let currentMissingSkills = [];

        job.skills.forEach(skill => {
            const skillLower = skill.toLowerCase();
            // Basic inclusion matching
            if (textLower.includes(skillLower)) {
                matchedCount++;
                currentMatchedSkills.push(skill);
            } else {
                currentMissingSkills.push(skill);
            }
        });

        const score = (matchedCount / job.skills.length) * 100;
        
        allMatches.push({
            role: job.role,
            score: Math.round(score),
            matchedSkills: currentMatchedSkills,
            missingSkills: currentMissingSkills
        });
    });

    // Sort by score descending and return Top 3
    allMatches.sort((a, b) => b.score - a.score);
    return allMatches.slice(0, 3);
}

/**
 * UI CONTROLLER
 */
function displayResults(matches, originalText) {
    const topMatch = matches[0]; // Primary result

    // FEATURE 2: Progress Bar Visualization
    topRolesContainer.innerHTML = '';
    matches.forEach((match, index) => {
        const div = document.createElement('div');
        div.className = 'role-item';
        div.innerHTML = `
            <div class="role-progress" style="width: 0%"></div>
            <div class="role-info"><strong>#${index + 1} ${match.role}</strong></div>
            <div class="role-score">${match.score}%</div>
        `;
        topRolesContainer.appendChild(div);

        // Animate progress bar with slight delay for visual effect
        setTimeout(() => {
            div.querySelector('.role-progress').style.width = `${match.score}%`;
        }, 100);
    });

    // Render Global Skills (Aggregate from top match for simplicity)
    renderList(matchedSkillsEl, topMatch.matchedSkills);
    renderList(missingSkillsEl, topMatch.missingSkills);

    // FEATURE 3: Resume Keyword Highlighting
    let highlightedHTML = originalText;
    
    // Only highlight skills that actually exist in the resume from the top match
    topMatch.matchedSkills.forEach(skill => {
        // Use a regex to do case-insensitive replacement globally
        const regex = new RegExp(`(${escapeRegExp(skill)})`, 'gi');
        highlightedHTML = highlightedHTML.replace(regex, '<span class="highlight">$1</span>');
    });
    
    highlightedTextEl.innerHTML = highlightedHTML;

    // Show result
    resultCard.classList.remove('hidden');
}

function renderList(element, items) {
    element.innerHTML = ''; 
    if (items.length === 0) {
        element.innerHTML = '<li>None</li>';
        return;
    }
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        element.appendChild(li);
    });
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    resultCard.classList.add('hidden');
}

// Utility to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
