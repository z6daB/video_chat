from django.shortcuts import render, redirect

def start(request):
    if request.user.is_authenticated:
        return redirect('chat/')
    else:
        return render(request, 'connect/index.html')
