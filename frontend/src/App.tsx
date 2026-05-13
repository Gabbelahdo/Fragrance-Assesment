import { LangProvider } from './i18n';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import AssessmentForm from './components/assessment/AssessmentForm';

function App() {
  return (
    <LangProvider>
      <LanguageSwitcher />
      <AssessmentForm />
    </LangProvider>
  );
}

export default App;
