from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import RegisterForm, LoginForm

# Create your views here.
def register(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(user)
            return redirect('chat/')
        else:
            form.add_error(None, 'Ошибка регистрации')
    else:
        form = RegisterForm()
    return render(request, 'accounts/register.html', {'form': form})

def login_user(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = authenticate(request, username=cd['username'],
                                password=cd['password'])
            if user:
                login(request, user)
                return redirect('/')
            else:
                form.add_error(None, 'Ошибка авторизации')
        else:
            print(form.errors)  # Вывод ошибок формы в консоль для отладки
    else:
        form = LoginForm()
    return render(request, 'accounts/login.html', context={'form': form})

def logout_user(request):
    logout(request)
    return redirect('/')