import { LangProvider } from './i18n';
import { Navbar } from './components/Navbar';
import AssessmentForm from './components/assessment/AssessmentForm';

function App() {
  return (
    <LangProvider>
      <Navbar />
      <AssessmentForm />
    </LangProvider>
  );
}

export default App;
