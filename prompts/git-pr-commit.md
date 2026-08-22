1. Commit the staged changes to Git. Make sure you draft the commit message     
  according to the guidelines defined below.                                      
                                                                                  
  2. If the changes are not staged, refuse to make the commit immediately. We want
   to avoid any unintentional commits, especially if the author has triggered the 
  command by accident.                                                            
                                                                                  
  3. Do not include the message below in the commit message:                      
  🤖 Generated with https://claude.ai/code                                        
  Co-Authored-By: Claude noreply@anthropic.com                                    
                                                                                  
  4. After committing, create a new branch from the current commit:               
     - Branch name format: `<type>/<short-description>` (e.g.,                    
  `feat/add-login-button`, `fix/user-auth-bug`)                                   
     - Use the commit type and a kebab-case version of the commit description     
     - Ensure branch name is lowercase and max 50 characters                      
                                                                                  
  5. Push the new branch to remote:                                               
     ```bash                                                                      
     git push -u origin <branch-name>                                             
                                                                                  
  6. Create a Pull Request to the develop branch using GitHub CLI:                
  gh pr create --base develop --title "<commit-subject>" --body                   
  "<commit-body-or-summary>"                                                      
    - Use the commit message subject as PR title                                  
    - Use the commit body (if any) or a brief summary as PR description           
    - If gh is not authenticated, inform the user to run gh auth login            
  7. Return the PR URL to the user upon completion.                               
                                                                                  
  Commit message convention:                                                      
                                                                                  
  - Use Conventional Commits format: type(scope): description                     
  - Types: feat, fix, test, refactor, docs, style, chore, perf, ci, build, revert 
  - Scope: Use the affected module, feature, or package (e.g., auth, api, ui).    
  Scope is optional but recommended.                                              
  - Description: Use the imperative mood (e.g., "add", "fix", "update").          
  - Subject line: Limit it to 72 characters only. If it exceeds even by one       
  character, Husky will block the commit.                                         
  - Optionally, add a body for more detail and a footer for breaking changes or   
  issue references.                                                               
                                                                                  
  Limits:                                                                         
  - Subject line: 72 characters max                                               
  - Body lines: 100 characters max (enforced by commitlint)                       
  - Commit message must be all lowercase